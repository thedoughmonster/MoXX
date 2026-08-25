-- service-owner: warehouse-projection

select cron.alter_job(
  job_id := jobid,
  schedule := '15 seconds',
  command := $command$
    update momi_events.deliveries
    set status = status
    where subscription_key = 'warehouse-projection-toast-v1'
      and status = 'queued'
      and next_attempt_at <= now()
      and event_id in (
        select event_id from momi_events.deliveries
        where subscription_key = 'warehouse-projection-toast-v1'
          and status = 'queued' and next_attempt_at <= now()
        order by next_attempt_at
        limit 5 for update skip locked
      )
  $command$
)
from cron.job
where jobname = 'momi-warehouse-projection-wakeup-v1';

do $$
begin
  if (select count(*) from cron.job
    where jobname = 'momi-warehouse-projection-wakeup-v1'
      and active and schedule = '15 seconds') <> 1
  then raise exception 'Warehouse projection recovery cadence is invalid'; end if;
end;
$$;
