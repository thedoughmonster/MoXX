-- service-owner: toast-data-acquisition

create index acquisition_jobs_recent_dispatch_idx
on toast_acquisition.jobs (
  last_dispatched_at desc, operation_key, restaurant_guid
)
where last_dispatched_at is not null;

create index api_attempts_recent_started_idx
on toast_raw.api_request_attempts (
  started_at desc, operation_key, restaurant_guid
);

select cron.alter_job(
  job_id := jobid,
  schedule := '1 second',
  command := $command$
    update toast_acquisition.jobs as target
    set capability_token = gen_random_uuid(),
        status = case
          when target.attempt_count >= 12 then 'dead_letter'
          else 'retry_wait'
        end,
        next_attempt_at = now(),
        lease_expires_at = null,
        last_dispatched_at = now(),
        last_error = case
          when target.status = 'running'
            then coalesce(target.last_error, 'worker lease expired')
          else target.last_error
        end
    where target.job_id in (
      select job.job_id
      from toast_acquisition.jobs as job
      join toast_acquisition.operations as operation
        on operation.operation_key = job.operation_key
      where (
        (job.status in ('pending', 'retry_wait')
          and job.next_attempt_at <= now())
        or (job.status = 'running' and job.lease_expires_at <= now())
      )
      and (
        job.status = 'running' or job.last_dispatched_at is null
        or job.last_dispatched_at <= now() - interval '30 seconds'
      )
      and not exists (
        select 1
        from toast_acquisition.jobs as dispatched
        where dispatched.operation_key = job.operation_key
          and dispatched.restaurant_guid = job.restaurant_guid
          and dispatched.last_dispatched_at > now() - interval '60 seconds'
          and dispatched.last_dispatched_at > now() - make_interval(
            secs => operation.minimum_dispatch_spacing_seconds
          )
      )
      and not exists (
        select 1
        from toast_raw.api_request_attempts as attempt
        where attempt.operation_key = job.operation_key
          and attempt.restaurant_guid = job.restaurant_guid
          and attempt.started_at > now() - interval '60 seconds'
          and attempt.started_at > now() - make_interval(
            secs => operation.minimum_dispatch_spacing_seconds
          )
      )
      order by case
          when job.status = 'running' then 0
          when job.mode in ('live', 'snapshot', 'reconcile') then 1
          when job.mode = 'repair' then 2
          else 3
        end,
        job.next_attempt_at, job.created_at, job.job_id
      limit 1 for update of job skip locked
    )
  $command$,
  active := true
)
from cron.job
where jobname = 'momi-toast-acquisition-wakeup-v1';

do $$
declare
  dispatch_command text;
begin
  select command into dispatch_command
  from cron.job
  where jobname = 'momi-toast-acquisition-wakeup-v1';

  if dispatch_command is null
    or dispatch_command not like
      '%dispatched.last_dispatched_at > now() - interval ''60 seconds''%'
    or dispatch_command not like
      '%attempt.started_at > now() - interval ''60 seconds''%'
  then
    raise exception 'Dispatch history bounds are invalid';
  end if;
end;
$$;
