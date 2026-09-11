-- Periodic sweeps: catch anything the live best-effort path missed (extract-resume's own
-- fire-and-forget call to embed-resume after a successful extraction). Same cron -> pg_net ->
-- Edge Function shape as fire-interview-reminders; each call with an empty body puts the target
-- function into sweep mode (see the two functions' own comments for exactly which rows that
-- picks up and the retry ceiling).
--
-- Two separate jobs, not one, because extraction and embedding are independent failure domains
-- with independent retry state (extraction_attempts vs embedding_attempts) -- a candidate stuck
-- on a transient embedding failure shouldn't cause its (already-successful) extraction to be
-- re-attempted, and vice versa.
--
-- Deliberately applied as its own migration, separate from
-- 20260911030000_trigger_resume_extraction_on_candidate_insert.sql: sweep mode processes up to
-- 20 real pending candidates per invocation (not a dry-run/no-op), so scheduling this before the
-- ~477-candidate backfill has been explicitly reviewed and run would mean the cron quietly runs
-- the bulk of that backfill itself, 15 minutes at a time, instead of the reviewed/approved
-- scripts/backfill-resume-search.mjs run. This migration is meant to be applied AFTER the full
-- backfill completes, at which point sweep mode reverts to its intended role -- catching
-- stragglers and retrying transient failures on an already-small remainder, not doing bulk work.

SELECT cron.schedule(
  'sweep-pending-candidate-extractions',
  '*/15 * * * *',
  $cron_body$
    SELECT net.http_post(
      url     := (SELECT value FROM public.hub_settings WHERE key = 'supabase_url')
                 || '/functions/v1/extract-resume',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM public.hub_settings WHERE key = 'service_role_key')
      ),
      body    := '{}'::jsonb
    ) as request_id;
  $cron_body$
);

SELECT cron.schedule(
  'sweep-pending-candidate-embeddings',
  '*/15 * * * *',
  $cron_body$
    SELECT net.http_post(
      url     := (SELECT value FROM public.hub_settings WHERE key = 'supabase_url')
                 || '/functions/v1/embed-resume',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM public.hub_settings WHERE key = 'service_role_key')
      ),
      body    := '{}'::jsonb
    ) as request_id;
  $cron_body$
);
