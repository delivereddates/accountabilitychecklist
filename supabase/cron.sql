-- ===========================================================================
-- Hourly notification scheduler (run once in the Supabase SQL editor)
--
-- Every hour this pings /api/cron/notify, which checks each user's local time
-- and sends the 11:00 / 17:00 / 21:00 notification to whoever has just passed
-- an enabled slot. The route authenticates with the CRON_SECRET.
--
-- BEFORE RUNNING: replace REPLACE_WITH_CRON_SECRET with the same value as the
-- CRON_SECRET env var in Vercel (openssl rand -hex 32).
-- ===========================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

-- Idempotent reschedule: drop any previous job with this name, then re-create.
select cron.unschedule('accountability-notify')
 where exists (select 1 from cron.job where jobname = 'accountability-notify');

select cron.schedule(
  'accountability-notify',
  '0 * * * *',
  $$
  select net.http_post(
    url      := 'https://accountabilitychecklist.vercel.app/api/cron/notify',
    headers  := jsonb_build_object(
                  'Content-Type', 'application/json',
                  'Authorization', 'Bearer ' || 'REPLACE_WITH_CRON_SECRET'
                ),
    body     := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Verify it's registered (expect one row) and that pings succeed:
--   select * from cron.job;
--   select id, status_code, error_msg from net._http_response order by id desc limit 5;
