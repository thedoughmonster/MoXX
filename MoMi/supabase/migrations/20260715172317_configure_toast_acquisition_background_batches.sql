-- service-owner: toast-data-acquisition

alter table toast_acquisition.operations
  add column worker_batch_enabled boolean not null default false,
  add column worker_max_runtime_seconds integer,
  add column worker_max_jobs integer,
  add column maximum_active_workers integer,
  add constraint operations_worker_batch_config_valid check (
    (not worker_batch_enabled and worker_max_runtime_seconds is null
      and worker_max_jobs is null
      and maximum_active_workers is null)
    or (worker_batch_enabled and exact_resource_only
      and pagination_kind = 'none'
      and worker_max_runtime_seconds between 60 and 350
      and worker_max_jobs between 1 and 500
      and maximum_active_workers between 1 and 10)
  );

update toast_acquisition.operations
set worker_batch_enabled = true,
    worker_max_runtime_seconds = 350,
    worker_max_jobs = 250,
    maximum_active_workers = 5
where operation_key = 'toast.payments.get.v1';

comment on column toast_acquisition.operations.worker_batch_enabled is
  'Allows atomic one-at-a-time job handoff inside a bounded worker lifetime.';
comment on column toast_acquisition.operations.worker_max_runtime_seconds is
  'Maximum background loop duration below the hosted worker wall-clock limit.';
comment on column toast_acquisition.operations.worker_max_jobs is
  'Maximum durable jobs processed within one background request CPU budget.';
comment on column toast_acquisition.operations.maximum_active_workers is
  'Maximum running or recently dispatched background workers per restaurant.';

create function toast_acquisition.complete_job_and_claim_next(
  p_job_id bigint,
  p_capability_token uuid
)
returns setof toast_acquisition.jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  finished_operation_key text;
  finished_source_key text;
  finished_restaurant_guid text;
  batching_enabled boolean;
begin
  update toast_acquisition.jobs as finished
  set status = 'succeeded', completed_at = now(), lease_expires_at = null,
      attempt_count = 0, page_count = finished.page_count + 1
  where finished.job_id = p_job_id
    and finished.capability_token = p_capability_token
    and finished.status = 'running' and finished.lease_expires_at > now()
    and finished.page_count < finished.page_budget
  returning finished.operation_key, finished.source_key,
    finished.restaurant_guid
  into finished_operation_key, finished_source_key,
    finished_restaurant_guid;
  if not found then raise exception 'Acquisition batch lease is invalid'; end if;
  select operation.worker_batch_enabled and operation.is_enabled
  into batching_enabled from toast_acquisition.operations as operation
  where operation.operation_key = finished_operation_key;
  if not coalesce(batching_enabled, false) then return; end if;

  return query
  with next_job as (
    select candidate.job_id
    from toast_acquisition.jobs as candidate
    where candidate.operation_key = finished_operation_key
      and candidate.source_key = finished_source_key
      and candidate.restaurant_guid = finished_restaurant_guid
      and candidate.mode = 'repair'
      and candidate.status in ('pending', 'retry_wait')
      and candidate.next_attempt_at <= now()
      and candidate.attempt_count < 12
      and candidate.page_count < candidate.page_budget
    order by candidate.next_attempt_at, candidate.created_at, candidate.job_id
    for update of candidate skip locked
    limit 1
  )
  update toast_acquisition.jobs as candidate
  set status = 'running',
      attempt_count = candidate.attempt_count + 1,
      lease_expires_at = now() + interval '120 seconds',
      last_dispatched_at = now(), last_error = null
  from next_job
  where candidate.job_id = next_job.job_id
  returning candidate.*;
end;
$$;

revoke all on function toast_acquisition.complete_job_and_claim_next(
  bigint, uuid
) from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from toast_acquisition.operations
    where operation_key = 'toast.payments.get.v1'
      and worker_batch_enabled and worker_max_runtime_seconds = 350
      and worker_max_jobs = 250
      and maximum_active_workers = 5
  ) then raise exception 'Payment background worker is not configured'; end if;
end;
$$;
