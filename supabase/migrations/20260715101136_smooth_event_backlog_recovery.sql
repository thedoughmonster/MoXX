-- service-owner: momi-event-routing

select cron.alter_job(
  job_id := jobid,
  schedule := '15 seconds',
  command := $command$
    update momi_events.routing_work
    set capability_token = gen_random_uuid(),
        status = case
          when attempt_count >= 12 then 'dead_letter'
          else 'retry_wait'
        end,
        next_attempt_at = now(),
        lease_expires_at = null,
        last_error = case
          when status = 'running'
            then coalesce(last_error, 'worker lease expired')
          else last_error
        end
    where event_id in (
      select event_id from momi_events.routing_work
      where (
        status in ('pending', 'retry_wait') and next_attempt_at <= now()
      ) or (
        status = 'running' and lease_expires_at <= now()
      )
      order by next_attempt_at
      limit 5 for update skip locked
    )
  $command$
)
from cron.job
where jobname = 'momi-event-routing-wakeup-v1';

do $$
begin
  if (select count(*) from cron.job
    where jobname = 'momi-event-routing-wakeup-v1'
      and active and schedule = '15 seconds') <> 1
  then raise exception 'Event routing recovery cadence is invalid'; end if;
end;
$$;
