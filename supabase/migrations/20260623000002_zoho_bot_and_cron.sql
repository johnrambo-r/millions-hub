-- zoho_bot_credentials: stores the Hub Reminders bot OAuth token
-- Only the service role (used by Edge Functions) can access this table.
-- No public RLS policies = zero access for authenticated frontend users.
create table public.zoho_bot_credentials (
  id                        uuid        primary key default gen_random_uuid(),
  client_id                 text        not null,
  client_secret             text        not null,
  refresh_token             text        not null,
  access_token              text,
  access_token_expires_at   timestamptz,
  updated_at                timestamptz not null default now()
);

alter table public.zoho_bot_credentials enable row level security;

-- hub_settings: key-value config for backend settings referenced by cron jobs
-- Only the service role and postgres superuser can access this table.
create table public.hub_settings (
  key    text primary key,
  value  text not null
);

alter table public.hub_settings enable row level security;

-- ─── One-time setup ───────────────────────────────────────────────────────────
-- After applying this migration, run the following in the Supabase SQL Editor
-- (Dashboard → SQL Editor) to configure the cron job and bot credentials.
--
-- 1. Hub settings (needed for the cron job to call the Edge Function):
--
--    insert into public.hub_settings (key, value) values
--      ('supabase_url', 'https://YOUR_PROJECT_ID.supabase.co'),
--      ('service_role_key', 'YOUR_SERVICE_ROLE_KEY')
--    on conflict (key) do update set value = excluded.value;
--
-- 2. Bot credentials (needed to send messages via Zoho Cliq):
--
--    insert into public.zoho_bot_credentials
--      (client_id, client_secret, refresh_token)
--    values
--      ('YOUR_ZOHO_CLIENT_ID', 'YOUR_ZOHO_CLIENT_SECRET', 'YOUR_ZOHO_REFRESH_TOKEN');
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pg_cron (schedules SQL at a set interval) and pg_net (async HTTP from SQL)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Fire the reminder check every 5 minutes.
-- The Edge Function computes exactly which reminders are due within the current window
-- and marks them fired_at after sending — this is the dedup guard against double-sends.
select cron.schedule(
  'fire-interview-reminders',
  '*/5 * * * *',
  $cron_body$
    select net.http_post(
      url     := (select value from public.hub_settings where key = 'supabase_url')
                 || '/functions/v1/send-interview-reminders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (select value from public.hub_settings where key = 'service_role_key')
      ),
      body    := '{}'::jsonb
    ) as request_id;
  $cron_body$
);
