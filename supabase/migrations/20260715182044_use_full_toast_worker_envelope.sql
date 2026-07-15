-- service-owner: toast-data-acquisition

alter table toast_acquisition.operations
  drop constraint operations_worker_batch_config_valid;

alter table toast_acquisition.operations
  add constraint operations_worker_batch_config_valid check (
    (not worker_batch_enabled and worker_max_runtime_seconds is null
      and worker_max_jobs is null and maximum_active_workers is null)
    or (worker_batch_enabled and exact_resource_only
      and pagination_kind = 'none'
      and worker_max_runtime_seconds between 60 and 400
      and worker_max_jobs between 1 and 500
      and maximum_active_workers between 1 and 10)
  );

update toast_acquisition.operations
set worker_max_runtime_seconds = 400,
    worker_max_jobs = 500
where operation_key = 'toast.payments.get.v1';

comment on column toast_acquisition.operations.worker_max_runtime_seconds is
  'Outer worker envelope; source and shutdown reserves gate every handoff.';

create index api_request_attempts_open_idx
  on toast_raw.api_request_attempts (started_at, attempt_id)
  where finished_at is null;

create function toast_acquisition.reconcile_stale_api_attempts()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reconciled_count integer;
begin
  with stale as materialized (
    select attempt.attempt_id
    from toast_raw.api_request_attempts as attempt
    left join toast_acquisition.jobs as job using (job_id)
    where attempt.finished_at is null
      and attempt.started_at < now() - interval '30 seconds'
      and not coalesce(
        job.status = 'running' and job.lease_expires_at > now(), false
      )
    order by attempt.started_at, attempt.attempt_id
    for update of attempt skip locked
    limit 100
  )
  update toast_raw.api_request_attempts as attempt
  set finished_at = now(),
      error_code = 'worker_interrupted',
      error_message =
        'Attempt closed after its acquisition worker stopped unexpectedly'
  from stale
  where attempt.attempt_id = stale.attempt_id;
  get diagnostics reconciled_count = row_count;
  return reconciled_count;
end;
$$;

revoke all on function toast_acquisition.reconcile_stale_api_attempts()
  from public, anon, authenticated;

select cron.schedule(
  'momi-toast-attempt-reconciliation-v1',
  '5 minutes',
  'select toast_acquisition.reconcile_stale_api_attempts()'
);

select toast_acquisition.reconcile_stale_api_attempts();

do $$
begin
  if not exists (
    select 1 from toast_acquisition.operations
    where operation_key = 'toast.payments.get.v1'
      and worker_max_runtime_seconds = 400 and worker_max_jobs = 500
  ) then raise exception 'Payment worker envelope is invalid'; end if;
  if (select count(*) from cron.job
    where jobname = 'momi-toast-attempt-reconciliation-v1'
      and active and schedule = '5 minutes') <> 1
  then raise exception 'Attempt reconciliation schedule is invalid'; end if;
  if exists (
    select 1 from toast_acquisition.archive_integrity_findings_v1
    where finding_code = 'RAW_ATTEMPT_STALE_OPEN'
  ) then raise exception 'Stale source attempts remain'; end if;
end;
$$;
