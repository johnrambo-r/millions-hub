// Extracts raw text from a candidate's resume (mammoth for .docx, unpdf for .pdf) and stores it
// on candidates.resume_text, so it can later be embedded for semantic search.
//
// unpdf (not pdfjs-dist directly) for PDFs: pdfjs-dist's legacy Node/Deno build lazily
// require()s @napi-rs/canvas as an optional canvas factory it never actually needs for text
// extraction (only for rendering, which this function never does) -- but Deno's npm resolver
// still pulls in all 11 platform-specific native binary packages for that optional dependency
// when building the deploy bundle, which alone pushed this function's bundle past Supabase's
// deploy size limit (413 request entity too large at ~32MB). unpdf wraps pdf.js with a
// canvas-free build made for exactly this (serverless/edge) use case.
//
// Two invocation modes, mirroring embed-resume:
//   - { candidate_id }  -- single candidate, called fire-and-forget from create_candidate() the
//                          moment a new candidate is inserted (see
//                          20260911030000_trigger_resume_extraction_on_candidate_insert.sql).
//   - no body / {}      -- sweep mode, called on a schedule by pg_cron to catch anything the live
//                          path missed or that failed transiently. Picks up rows with
//                          extraction_status = 'pending', or 'failed' with attempts under the
//                          retry ceiling.
//
// resume_url is a public-URL-*shaped* string even though the `resumes` bucket is private
// (20260806020000_restrict_resumes_bucket_to_authenticated.sql) -- the real storage path is
// recovered by splitting on the same marker CandidatePanel.jsx uses client-side
// (src/components/pipeline/CandidatePanel.jsx:498-504), then downloaded with the service-role
// client, which bypasses bucket RLS entirely.
//
// .doc (legacy binary Word format) is accepted by the upload form (AddCandidate.jsx accepts
// .pdf/.doc/.docx) but is NOT supported here -- mammoth only reads .docx (Open XML), and there is
// no lightweight legacy .doc parser available. Those candidates are marked extraction_status =
// 'failed' with a clear reason rather than silently skipped, same as any other extraction failure.

import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";
import mammoth from "mammoth";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

const MAX_EXTRACTION_ATTEMPTS = 5;
const RESUME_URL_MARKER = "/storage/v1/object/public/resumes/";

function extractStoragePath(url: string | null): string | null {
  if (!url) return null;
  if (!url.startsWith("http")) return url;
  const idx = url.indexOf(RESUME_URL_MARKER);
  return idx === -1 ? null : url.slice(idx + RESUME_URL_MARKER.length);
}

// Postgres text columns cannot contain the NUL byte -- confirmed present in real extracted PDF
// text from malformed font/glyph mappings (the source of the "TT: undefined function" /
// "invalid function id" warnings pdf.js logs for the same files), which previously surfaced as
// "unsupported Unicode escape sequence" failing the save, not the extraction itself. Strips all
// C0 control characters (code points below 32) except normal whitespace (tab=9, newline=10,
// carriage return=13). Written as a codePointAt loop, not a regex character class, so no literal
// control bytes need to appear anywhere in this source file.
function sanitizeExtractedText(text: string): string {
  let result = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const isStrippedControlChar = code < 32 && code !== 9 && code !== 10 && code !== 13;
    if (!isStrippedControlChar) result += ch;
  }
  return result;
}

async function extractText(bytes: Uint8Array, path: string): Promise<string> {
  const lower = path.toLowerCase();

  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return sanitizeExtractedText(result.value.trim());
  }

  if (lower.endsWith(".pdf")) {
    const doc = await getDocumentProxy(bytes);
    const { text } = await extractPdfText(doc, { mergePages: true });
    return sanitizeExtractedText(text.trim());
  }

  if (lower.endsWith(".doc")) {
    throw new Error("Legacy .doc format is not supported for text extraction (only .docx and .pdf)");
  }

  throw new Error(`Unrecognized resume file type: ${path}`);
}

type CandidateRow = { id: string; resume_url: string | null; extraction_attempts: number };

// deno-lint-ignore no-explicit-any
async function processCandidate(
  supabase: any,
  candidate: CandidateRow,
): Promise<{ id: string; ok: boolean; error?: string }> {
  const path = extractStoragePath(candidate.resume_url);

  try {
    if (!path) throw new Error(`Could not resolve storage path from resume_url: ${candidate.resume_url}`);

    const { data: fileBlob, error: downloadError } = await supabase.storage.from("resumes").download(path);
    if (downloadError || !fileBlob) {
      throw new Error(`Resume download failed: ${downloadError?.message ?? "no file returned"}`);
    }

    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    const text = await extractText(bytes, path);

    if (!text) throw new Error("Extraction produced no text (resume may be a scanned image with no text layer)");

    const { error: updateError } = await supabase
      .from("candidates")
      .update({
        resume_text: text,
        extraction_status: "done",
        extraction_error: null,
        extracted_at: new Date().toISOString(),
        extraction_attempts: candidate.extraction_attempts + 1,
      })
      .eq("id", candidate.id);
    if (updateError) throw new Error(`Failed to save extracted text: ${updateError.message}`);

    // Best-effort immediate embed; the embed-resume sweep cron catches this if it fails.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey) {
      fetch(`${supabaseUrl}/functions/v1/embed-resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ candidate_id: candidate.id }),
      }).catch((err) => console.error(`[extract-resume] failed to trigger embed for ${candidate.id}:`, err));
    }

    return { id: candidate.id, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("candidates")
      .update({
        extraction_status: "failed",
        extraction_error: message,
        extraction_attempts: candidate.extraction_attempts + 1,
      })
      .eq("id", candidate.id);
    console.error(`[extract-resume] candidate ${candidate.id}:`, message);
    return { id: candidate.id, ok: false, error: message };
  }
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let candidateId: string | undefined;
    try {
      const body = await req.json();
      candidateId = body?.candidate_id;
    } catch {
      // empty/invalid body => sweep mode
    }

    let candidates: Array<{ id: string; resume_url: string | null; extraction_attempts: number }>;

    if (candidateId) {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, resume_url, extraction_attempts")
        .eq("id", candidateId)
        .maybeSingle();
      if (error || !data) {
        return Response.json({ error: error?.message ?? "candidate not found" }, { status: 404 });
      }
      candidates = [data];
    } else {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, resume_url, extraction_attempts")
        .or(`extraction_status.eq.pending,and(extraction_status.eq.failed,extraction_attempts.lt.${MAX_EXTRACTION_ATTEMPTS})`)
        .limit(20);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      candidates = data ?? [];
    }

    if (!candidates.length) {
      return Response.json({ processed: 0, succeeded: 0, failed: 0 });
    }

    const results = await Promise.all(candidates.map((c) => processCandidate(supabase, c)));
    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    return Response.json({
      processed: results.length,
      succeeded,
      failed: failed.length,
      ...(failed.length ? { failures: failed.map((f) => ({ id: f.id, error: f.error })) } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[extract-resume] unexpected error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
});
