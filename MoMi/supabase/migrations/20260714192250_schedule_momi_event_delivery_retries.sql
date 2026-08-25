-- service-owner: momi-event-routing

select cron.schedule(
  'momi-event-delivery-retries-v1',
  '15 seconds',
  'select momi_events.enqueue_due_delivery_retries()'
);
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'momi-event-delivery-retries-v1';
