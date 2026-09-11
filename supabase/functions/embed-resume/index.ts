// Generates an OpenAI text-embedding-3-small vector for a candidate's extracted resume text and
// stores it on candidates.embedding (pgvector, see
// 20260911000000_add_resume_search_columns_to_candidates.sql), so the search-candidates function
// can rank candidates against a query embedding.
//
// Two invocation modes, mirroring extract-resume:
//   - { candidate_id }  -- single candidate, called fire-and-forget from extract-resume right
//                          after a successful extraction.
//   - no body / {}      -- sweep mode, called on a schedule by pg_cron
//                          (sweep-pending-candidate-embeddings in
//                          20260911030000_trigger_resume_extraction_on_candidate_insert.sql) to
//                          catch anything the live path missed or that failed transiently. Picks
//                          up candidates whose extraction is done but embedding is 'pending', or
//                          'failed' with attempts under the retry ceiling.
//
// text-embedding-3-small's input limit is ~8191 tokens; resume_text is truncated to a generous
// character budget below as a defensive guard against the rare oversized resume, rather than
// letting the OpenAI call fail outright for that candidate.

import { createClient } from "@supabase/supabase-js";

const MAX_EMBEDDING_ATTEMPTS = 5;
const MAX_RESUME_CHARS = 24000; // ~6k tokens, comfortably under the 8191-token model limit
const SWEEP_BATCH_SIZE = 20;
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";

type CandidateRow = { id: string; resume_text: string | null; embedding_attempts: number };

async function embedText(text: string): Promise<number[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const res = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.slice(0, MAX_RESUME_CHARS) }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embeddings request failed: HTTP ${res.status} — ${body}`);
  }

  const json = await res.json();
  const embedding = json?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) throw new Error("OpenAI response did not contain an embedding array");
  return embedding;
}

// deno-lint-ignore no-explicit-any
async function processCandidate(
  supabase: any,
  candidate: CandidateRow,
): Promise<{ id: string; ok: boolean; error?: string }> {
  try {
    if (!candidate.resume_text || !candidate.resume_text.trim()) {
      throw new Error("No resume_text to embed (extraction may not have produced usable text)");
    }

    const embedding = await embedText(candidate.resume_text);

    const { error: updateError } = await supabase
      .from("candidates")
      .update({
        embedding,
        embedding_status: "done",
        embedding_error: null,
        embedded_at: new Date().toISOString(),
        embedding_attempts: candidate.embedding_attempts + 1,
      })
      .eq("id", candidate.id);
    if (updateError) throw new Error(`Failed to save embedding: ${updateError.message}`);

    return { id: candidate.id, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("candidates")
      .update({
        embedding_status: "failed",
        embedding_error: message,
        embedding_attempts: candidate.embedding_attempts + 1,
      })
      .eq("id", candidate.id);
    console.error(`[embed-resume] candidate ${candidate.id}:`, message);
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

    let candidates: CandidateRow[];

    if (candidateId) {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, resume_text, embedding_attempts, extraction_status")
        .eq("id", candidateId)
        .maybeSingle();
      if (error || !data) {
        return Response.json({ error: error?.message ?? "candidate not found" }, { status: 404 });
      }
      if (data.extraction_status !== "done") {
        return Response.json({ skipped: true, reason: "extraction not done yet" });
      }
      candidates = [data];
    } else {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, resume_text, embedding_attempts")
        .eq("extraction_status", "done")
        .or(`embedding_status.eq.pending,and(embedding_status.eq.failed,embedding_attempts.lt.${MAX_EMBEDDING_ATTEMPTS})`)
        .limit(SWEEP_BATCH_SIZE);
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
    console.error("[embed-resume] unexpected error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
});
