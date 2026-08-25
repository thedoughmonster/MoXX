-- service-owner: toast-data-acquisition

select cron.alter_job(
  job_id := jobid,
  schedule := '15 seconds',
  command := $command$
    update toast_acquisition.jobs
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
    where job_id in (
      select job_id from toast_acquisition.jobs
      where (
        status in ('pending', 'retry_wait') and next_attempt_at <= now()
      ) or (
        status = 'running' and lease_expires_at <= now()
      )
      order by case
          when status = 'running' then 0
          when mode in ('live', 'snapshot', 'reconcile') then 1
          when mode = 'repair' then 2
          else 3
        end,
        next_attempt_at, created_at, job_id
      limit 5 for update skip locked
    )
  $command$
)
from cron.job
where jobname = 'momi-toast-acquisition-wakeup-v1';

do $$
begin
  if (select count(*) from cron.job
    where jobname = 'momi-toast-acquisition-wakeup-v1'
      and active and schedule = '15 seconds') <> 1
  then raise exception 'Acquisition recovery cadence is invalid'; end if;
end;
$$;
