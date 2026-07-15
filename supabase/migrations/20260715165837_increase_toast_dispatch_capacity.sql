-- service-owner: toast-data-acquisition

alter table toast_acquisition.operations
  add column maximum_dispatches_per_tick integer not null default 1,
  add constraint operations_dispatch_capacity_valid check (
    maximum_dispatches_per_tick between 1 and 2
  );

update toast_acquisition.operations
set maximum_dispatches_per_tick = 2
where operation_key = 'toast.payments.get.v1';

comment on column toast_acquisition.operations.maximum_dispatches_per_tick is
  'Per-second operation capacity inside the two-request dispatcher ceiling.';

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
      with eligible as (
        select job.job_id, job.operation_key, job.restaurant_guid,
          job.next_attempt_at, job.created_at,
          operation.maximum_dispatches_per_tick,
          case when job.status = 'running' then 0
            when job.mode in ('live', 'snapshot', 'reconcile') then 1
            when job.mode = 'repair' then 2 else 3 end as priority,
          row_number() over (
            partition by job.operation_key, job.restaurant_guid
            order by case when job.status = 'running' then 0
                when job.mode in ('live', 'snapshot', 'reconcile') then 1
                when job.mode = 'repair' then 2 else 3 end,
              job.next_attempt_at, job.created_at, job.job_id
          ) as operation_dispatch_rank
        from toast_acquisition.jobs as job
        join toast_acquisition.operations as operation
          on operation.operation_key = job.operation_key
        where ((job.status in ('pending', 'retry_wait')
              and job.next_attempt_at <= now())
            or (job.status = 'running' and job.lease_expires_at <= now()))
          and (job.status = 'running' or job.last_dispatched_at is null
            or job.last_dispatched_at <= now() - interval '30 seconds')
          and not exists (
            select 1 from toast_acquisition.jobs as dispatched
            where dispatched.operation_key = job.operation_key
              and dispatched.restaurant_guid = job.restaurant_guid
              and dispatched.last_dispatched_at > now() - interval '60 seconds'
              and dispatched.last_dispatched_at > now() - make_interval(
                secs => operation.minimum_dispatch_spacing_seconds
              )
          )
          and not exists (
            select 1 from toast_raw.api_request_attempts as attempt
            where attempt.operation_key = job.operation_key
              and attempt.restaurant_guid = job.restaurant_guid
              and attempt.started_at > now() - interval '60 seconds'
              and attempt.started_at > now() - make_interval(
                secs => operation.minimum_dispatch_spacing_seconds
              )
          )
      )
      select job.job_id
      from eligible
      join toast_acquisition.jobs as job using (job_id)
      where eligible.operation_dispatch_rank
        <= eligible.maximum_dispatches_per_tick
      order by eligible.operation_dispatch_rank, eligible.priority,
        eligible.next_attempt_at, eligible.created_at, eligible.job_id
      limit 2 for update of job skip locked
    )
  $command$,
  active := true
)
from cron.job
where jobname = 'momi-toast-acquisition-wakeup-v1';

do $$
declare dispatch_command text;
begin
  select command into dispatch_command from cron.job
  where jobname = 'momi-toast-acquisition-wakeup-v1';
  if dispatch_command not like '%operation_dispatch_rank%'
    or dispatch_command not like '%limit 2 for update of job skip locked%'
  then raise exception 'Acquisition dispatch capacity is invalid'; end if;
  if (select maximum_dispatches_per_tick from toast_acquisition.operations
      where operation_key = 'toast.payments.get.v1') is distinct from 2
  then raise exception 'Payment detail dispatch capacity is invalid'; end if;
  if (select minimum_dispatch_spacing_seconds from toast_acquisition.operations
      where operation_key = 'toast.orders.bulk.v1') is distinct from 5
  then raise exception 'Historical order spacing is invalid'; end if;
end;
$$;
