-- service-owner: toast-data-acquisition

update toast_acquisition.operations
set maximum_active_workers = 4
where operation_key = 'toast.payments.get.v1';

select cron.alter_job(
  job_id := jobid,
  schedule := '1 second',
  command := $command$
    update toast_acquisition.jobs as target
    set capability_token = gen_random_uuid(),
        status = case when target.attempt_count >= 12
          then 'dead_letter' else 'retry_wait' end,
        next_attempt_at = now(), lease_expires_at = null,
        last_dispatched_at = now(),
        last_error = case when target.status = 'running'
          then coalesce(target.last_error, 'worker lease expired')
          else target.last_error end
    where target.job_id in (
      with active_workers as materialized (
        select worker.operation_key, worker.restaurant_guid,
          count(*)::integer as active_worker_count
        from toast_acquisition.jobs as worker
        join toast_acquisition.operations as worker_operation
          on worker_operation.operation_key = worker.operation_key
          and worker_operation.worker_batch_enabled
        where (worker.status = 'running' and worker.lease_expires_at > now())
          or (worker.status in ('pending', 'retry_wait')
            and worker.last_dispatched_at > now() - interval '30 seconds')
        group by worker.operation_key, worker.restaurant_guid
      ), ranked as materialized (
        select job.job_id, job.operation_key, job.restaurant_guid,
          job.next_attempt_at, job.created_at,
          operation.maximum_dispatches_per_tick,
          operation.minimum_dispatch_spacing_seconds,
          operation.worker_batch_enabled,
          operation.maximum_active_workers,
          coalesce(active.active_worker_count, 0) as active_worker_count,
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
        left join active_workers as active
          on active.operation_key = job.operation_key
          and active.restaurant_guid = job.restaurant_guid
        where ((job.status in ('pending', 'retry_wait')
              and job.next_attempt_at <= now())
            or (job.status = 'running' and job.lease_expires_at <= now()))
          and (job.status = 'running' or job.last_dispatched_at is null
            or job.last_dispatched_at <= now() - interval '30 seconds')
      )
      select job.job_id
      from ranked
      join toast_acquisition.jobs as job using (job_id)
      where ranked.operation_dispatch_rank
          <= ranked.maximum_dispatches_per_tick
        and (not ranked.worker_batch_enabled
          or ranked.operation_dispatch_rank <= greatest(
            0, ranked.maximum_active_workers - ranked.active_worker_count
          ))
        and not exists (
          select 1 from toast_acquisition.jobs as dispatched
          where dispatched.operation_key = ranked.operation_key
            and dispatched.restaurant_guid = ranked.restaurant_guid
            and dispatched.last_dispatched_at > now() - interval '60 seconds'
            and dispatched.last_dispatched_at > now() - make_interval(
              secs => ranked.minimum_dispatch_spacing_seconds
            )
        )
        and not exists (
          select 1 from toast_raw.api_request_attempts as attempt
          where attempt.operation_key = ranked.operation_key
            and attempt.restaurant_guid = ranked.restaurant_guid
            and attempt.started_at > now() - interval '60 seconds'
            and attempt.started_at > now() - make_interval(
              secs => ranked.minimum_dispatch_spacing_seconds
            )
        )
      order by ranked.operation_dispatch_rank, ranked.priority,
        ranked.next_attempt_at, ranked.created_at, ranked.job_id
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
  if dispatch_command not like '%ranked as materialized%'
    or dispatch_command not like '%limit 2 for update of job skip locked%'
  then raise exception 'Bounded dispatch ranking is invalid'; end if;
  if (select maximum_active_workers from toast_acquisition.operations
      where operation_key = 'toast.payments.get.v1') is distinct from 4
  then raise exception 'Payment worker capacity is invalid'; end if;
  if (select minimum_dispatch_spacing_seconds from toast_acquisition.operations
      where operation_key = 'toast.orders.bulk.v1') is distinct from 5
  then raise exception 'Historical order spacing is invalid'; end if;
end;
$$;
