-- Daily cleanup of pg_cron / pg_net system log tables.
-- cron.job_run_details logs every cron job execution (used by fire-interview-reminders);
-- net._http_response logs every net.http_post response body. Both are populated automatically
-- by the platform, are not read by any Hub application code, and have no built-in retention,
-- so they grow unbounded. 14 days is enough history to debug a missed/failed reminder run.
select cron.schedule(
  'cleanup-job-run-and-http-logs',
  '17 3 * * *',
  $cron_body$
    delete from cron.job_run_details where start_time < now() - interval '14 days';
    delete from net._http_response where created < now() - interval '14 days';
  $cron_body$
);
