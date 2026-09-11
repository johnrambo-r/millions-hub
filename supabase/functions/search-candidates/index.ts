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

// This function is called directly from the browser (unlike extract-resume/embed-resume, which
// are only ever called server-to-server by pg_cron/pg_net), so it needs to handle the CORS
// preflight (OPTIONS) request browsers send before a cross-origin POST with a JSON body and
// custom headers (Authorization, apikey) -- Supabase Edge Functions don't add these
// automatically. Access-Control-Allow-Origin: * is safe here since auth is a Bearer token
// (verify_jwt = true at the gateway), not cookies -- there's no credential to leak to another
// origin by allowing any origin to read the response.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
  // Preflight: the browser sends this before the real POST and requires a CORS-headers-bearing
  // response before it will even attempt the actual request.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { query, match_count } = await req.json().catch(() => ({}));

    if (typeof query !== "string" || !query.trim()) {
      return jsonResponse({ error: "query is required" }, 400);
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

    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({ results: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[search-candidates] error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
