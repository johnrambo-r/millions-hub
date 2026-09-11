#!/usr/bin/env node
// One-time batch backfill: extracts resume text + generates embeddings for existing candidates
// (the live path in supabase/functions/extract-resume + embed-resume only runs going forward, on
// new candidates — this script covers everyone created before this feature existed).
//
// Reuses the exact same extraction/embedding logic as the two Edge Functions, reimplemented here
// in plain Node rather than shared with them: Deno and Node resolve npm packages differently
// enough (see supabase/functions/extract-resume/index.ts's comment on the Deno pdf.js spike) that
// forcing a shared module wasn't worth the coupling for ~30 lines of logic.
//
// Usage:
//   node scripts/backfill-resume-search.mjs                 # full run
//   node scripts/backfill-resume-search.mjs --limit 20       # first N candidates per phase only
//   node scripts/backfill-resume-search.mjs --dry-run         # log what would happen, write nothing
//
// Required env vars (plain process.env, NOT the VITE_-prefixed frontend ones — this never runs in
// a browser): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.
// If OPENAI_API_KEY is absent, the extraction phase still runs; the embedding phase is skipped
// with a clear note in the summary rather than failing every row.
//
// Idempotent: only touches candidates with extraction_status/embedding_status != 'done', so a
// partial or interrupted run is always safe to re-launch.

import { createClient } from '@supabase/supabase-js'
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

const MAX_ATTEMPTS = 5
const PAGE_SIZE = 100
const EXTRACT_CONCURRENCY = 5
const EMBED_CONCURRENCY = 5
const MAX_RESUME_CHARS = 24000
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'
const EMBEDDING_MODEL = 'text-embedding-3-small'
const RESUME_URL_MARKER = '/storage/v1/object/public/resumes/'

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitArg = args.find((a) => a.startsWith('--limit'))
const limit = limitArg
  ? parseInt(limitArg.includes('=') ? limitArg.split('=')[1] : args[args.indexOf(limitArg) + 1], 10)
  : null

if (limitArg && (!Number.isFinite(limit) || limit <= 0)) {
  console.error('--limit must be a positive integer')
  process.exit(1)
}

// ─── env ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.')
  process.exit(1)
}
if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY not set — extraction will run, embedding phase will be skipped.')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ─── helpers ────────────────────────────────────────────────────────────────

function extractStoragePath(url) {
  if (!url) return null
  if (!url.startsWith('http')) return url
  const idx = url.indexOf(RESUME_URL_MARKER)
  return idx === -1 ? null : url.slice(idx + RESUME_URL_MARKER.length)
}

async function mapLimit(items, concurrency, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function extractText(bytes, path) {
  const lower = path.toLowerCase()

  if (lower.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    return result.value.trim()
  }

  if (lower.endsWith('.pdf')) {
    const doc = await pdfjsLib.getDocument({
      data: bytes,
      useWorkerFetch: false,
      useSystemFonts: true,
    }).promise

    let fullText = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      fullText += content.items.map((it) => it.str ?? '').join(' ') + '\n'
    }
    return fullText.trim()
  }

  if (lower.endsWith('.doc')) {
    throw new Error('Legacy .doc format is not supported for text extraction (only .docx and .pdf)')
  }

  throw new Error(`Unrecognized resume file type: ${path}`)
}

async function embedWithRetry(text, attempts = 3) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.slice(0, MAX_RESUME_CHARS) }),
      })
      if (!res.ok) {
        const body = await res.text()
        const transient = res.status >= 500 || res.status === 429
        if (transient && i < attempts - 1) {
          await sleep(500 * 2 ** i)
          continue
        }
        throw new Error(`OpenAI embeddings request failed: HTTP ${res.status} — ${body}`)
      }
      const json = await res.json()
      const embedding = json?.data?.[0]?.embedding
      if (!Array.isArray(embedding)) throw new Error('OpenAI response did not contain an embedding array')
      return embedding
    } catch (err) {
      lastError = err
      if (i < attempts - 1) await sleep(500 * 2 ** i)
    }
  }
  throw lastError
}

// ─── phase 1: extraction ────────────────────────────────────────────────────

async function fetchExtractionCandidates(cap) {
  const rows = []
  let from = 0
  while (!cap || rows.length < cap) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('candidates')
      .select('id, resume_url, extraction_attempts')
      .or(`extraction_status.eq.pending,and(extraction_status.eq.failed,extraction_attempts.lt.${MAX_ATTEMPTS})`)
      .order('id', { ascending: true })
      .range(from, to)
    if (error) throw new Error(`Failed to fetch candidates for extraction: ${error.message}`)
    if (!data.length) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return cap ? rows.slice(0, cap) : rows
}

async function runExtraction() {
  const candidates = await fetchExtractionCandidates(limit)
  console.log(`\n── Extraction: ${candidates.length} candidate(s) to process ──`)

  const succeeded = []
  const failed = []

  await mapLimit(candidates, EXTRACT_CONCURRENCY, async (candidate) => {
    const path = extractStoragePath(candidate.resume_url)
    try {
      if (!path) throw new Error(`Could not resolve storage path from resume_url: ${candidate.resume_url}`)

      const { data: fileBlob, error: downloadError } = await supabase.storage.from('resumes').download(path)
      if (downloadError || !fileBlob) {
        throw new Error(`Resume download failed: ${downloadError?.message ?? 'no file returned'}`)
      }

      const bytes = new Uint8Array(await fileBlob.arrayBuffer())
      const text = await extractText(bytes, path)
      if (!text) throw new Error('Extraction produced no text (resume may be a scanned image with no text layer)')

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('candidates')
          .update({
            resume_text: text,
            extraction_status: 'done',
            extraction_error: null,
            extracted_at: new Date().toISOString(),
            extraction_attempts: candidate.extraction_attempts + 1,
          })
          .eq('id', candidate.id)
        if (updateError) throw new Error(`Failed to save extracted text: ${updateError.message}`)
      }

      succeeded.push(candidate.id)
      process.stdout.write('.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!dryRun) {
        await supabase
          .from('candidates')
          .update({
            extraction_status: 'failed',
            extraction_error: message,
            extraction_attempts: candidate.extraction_attempts + 1,
          })
          .eq('id', candidate.id)
      }
      failed.push({ id: candidate.id, reason: message })
      process.stdout.write('x')
    }
  })

  console.log('')
  return { succeeded, failed }
}

// ─── phase 2: embedding ─────────────────────────────────────────────────────

async function fetchEmbeddingCandidates(cap) {
  const rows = []
  let from = 0
  while (!cap || rows.length < cap) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('candidates')
      .select('id, resume_text, embedding_attempts')
      .eq('extraction_status', 'done')
      .or(`embedding_status.eq.pending,and(embedding_status.eq.failed,embedding_attempts.lt.${MAX_ATTEMPTS})`)
      .order('id', { ascending: true })
      .range(from, to)
    if (error) throw new Error(`Failed to fetch candidates for embedding: ${error.message}`)
    if (!data.length) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return cap ? rows.slice(0, cap) : rows
}

async function runEmbedding() {
  const candidates = await fetchEmbeddingCandidates(limit)
  console.log(`\n── Embedding: ${candidates.length} candidate(s) to process ──`)

  const succeeded = []
  const failed = []

  await mapLimit(candidates, EMBED_CONCURRENCY, async (candidate) => {
    try {
      if (!candidate.resume_text?.trim()) {
        throw new Error('No resume_text to embed')
      }

      const embedding = await embedWithRetry(candidate.resume_text)

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('candidates')
          .update({
            embedding,
            embedding_status: 'done',
            embedding_error: null,
            embedded_at: new Date().toISOString(),
            embedding_attempts: candidate.embedding_attempts + 1,
          })
          .eq('id', candidate.id)
        if (updateError) throw new Error(`Failed to save embedding: ${updateError.message}`)
      }

      succeeded.push(candidate.id)
      process.stdout.write('.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!dryRun) {
        await supabase
          .from('candidates')
          .update({
            embedding_status: 'failed',
            embedding_error: message,
            embedding_attempts: candidate.embedding_attempts + 1,
          })
          .eq('id', candidate.id)
      }
      failed.push({ id: candidate.id, reason: message })
      process.stdout.write('x')
    }
  })

  console.log('')
  return { succeeded, failed }
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Resume search backfill${dryRun ? ' (DRY RUN — no writes)' : ''}${limit ? ` — limit ${limit} per phase` : ''}`)
  const start = Date.now()

  const extraction = await runExtraction()
  const embedding = OPENAI_API_KEY ? await runEmbedding() : { succeeded: [], failed: [], skipped: true }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log('\n════════════════════════════════════════════════════════')
  console.log('SUMMARY')
  console.log('════════════════════════════════════════════════════════')
  console.log(
    `Extraction: ${extraction.succeeded.length} succeeded, ${extraction.failed.length} flagged for manual review`,
  )
  if (extraction.failed.length) {
    for (const f of extraction.failed) console.log(`  - ${f.id}: ${f.reason}`)
  }

  if (embedding.skipped) {
    console.log('Embedding: skipped (OPENAI_API_KEY not set)')
  } else {
    console.log(
      `Embedding: ${embedding.succeeded.length} succeeded, ${embedding.failed.length} flagged for manual review`,
    )
    if (embedding.failed.length) {
      for (const f of embedding.failed) console.log(`  - ${f.id}: ${f.reason}`)
    }
  }
  console.log(`Elapsed: ${elapsed}s`)
  console.log('════════════════════════════════════════════════════════')
}

main().catch((err) => {
  console.error('\nBackfill script failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
