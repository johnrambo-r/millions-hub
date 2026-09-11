// Natural-language candidate search: embeds the recruiter's query text via OpenAI, then ranks
// candidates against it using search_candidates_by_embedding()
// (20260911020000_search_candidates_by_embedding.sql).
//
// verify_jwt = true (supabase/config.toml) -- unlike extract-resume/embed-resume, this function is
// called directly from the browser with the signed-in user's own JWT, so the platform gateway
// verifies it before this code ever runs. The Supabase client built below is constructed with the
// *user's* Authorization header (anon key + their access token), not the service role key, so the
// search RPC runs under that user's own row-level security -- results are scoped to exactly the
// same candidates they could already see via a normal `.from('candidates').select()` call
// elsewhere in the app (search_candidates_by_embedding is SECURITY INVOKER for the same reason).

import { createClient } from "@supabase/supabase-js";

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_QUERY_CHARS = 2000;
const DEFAULT_MATCH_COUNT = 20;

async function embedQuery(text: string): Promise<number[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const res = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.slice(0, MAX_QUERY_CHARS) }),
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

Deno.serve(async (req) => {
  try {
    const { query, match_count } = await req.json().catch(() => ({}));

    if (typeof query !== "string" || !query.trim()) {
      return Response.json({ error: "query is required" }, { status: 400 });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const queryEmbedding = await embedQuery(query.trim());

    const { data, error } = await supabase.rpc("search_candidates_by_embedding", {
      query_embedding: queryEmbedding,
      match_count: Math.min(Math.max(Number(match_count) || DEFAULT_MATCH_COUNT, 1), 50),
    });

    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ results: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[search-candidates] error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
});
