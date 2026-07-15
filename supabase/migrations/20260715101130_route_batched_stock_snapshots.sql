-- service-owner: warehouse-projection

create or replace function warehouse_projection.project_toast_daily_stock_snapshot(
  p_job_id bigint,
  p_correlation_id uuid
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select warehouse_projection.project_toast_stock_snapshot(
    p_job_id, p_correlation_id
  );
$$;

create or replace function warehouse_projection.emit_daily_stock_snapshot_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.operation_key <> 'toast.stock.snapshot.v1'
    or new.status <> 'succeeded'
    or old.status = 'succeeded' then return new; end if;
  if not exists (
    select 1 from toast_raw.api_request_attempts as attempt
    where attempt.job_id = new.job_id
      and attempt.http_status between 200 and 299
      and attempt.finished_at is not null
      and jsonb_typeof(attempt.response_json) = 'array'
  ) then raise exception 'stock_archive_missing'; end if;
  insert into momi_events.events (
    event_name, idempotency_key, occurred_at, schema_version,
    source_system, source_resource_type, source_id,
    source_reference, correlation_id
  ) values (
    'source.toast.resource.stock_snapshot.completed',
    'toast:stock-job:' || new.job_id,
    coalesce(new.completed_at, now()), 1,
    'toast', 'stock_snapshot', new.job_id::text,
    jsonb_build_object(
      'schema', 'toast_acquisition', 'table', 'jobs', 'id', new.job_id
    ), new.correlation_id
  ) on conflict (idempotency_key) do nothing;
  return new;
end;
$$;

insert into momi_events.events (
  event_name, idempotency_key, occurred_at, schema_version,
  source_system, source_resource_type, source_id,
  source_reference, correlation_id
)
select 'source.toast.resource.stock_snapshot.completed',
  'toast:stock-job:' || job.job_id,
  coalesce(job.completed_at, now()), 1,
  'toast', 'stock_snapshot', job.job_id::text,
  jsonb_build_object(
    'schema', 'toast_acquisition', 'table', 'jobs', 'id', job.job_id
  ), job.correlation_id
from toast_acquisition.jobs as job
where job.operation_key = 'toast.stock.snapshot.v1'
  and job.status = 'succeeded'
  and job.job_id = (
    select max(latest.job_id) from toast_acquisition.jobs as latest
    where latest.operation_key = 'toast.stock.snapshot.v1'
      and latest.status = 'succeeded'
  )
  and exists (
    select 1 from toast_raw.api_request_attempts as attempt
    where attempt.job_id = job.job_id
      and attempt.http_status between 200 and 299
      and attempt.finished_at is not null
      and jsonb_typeof(attempt.response_json) = 'array'
  )
on conflict (idempotency_key) do nothing;

revoke all on function warehouse_projection.project_toast_daily_stock_snapshot(
  bigint, uuid
) from public, anon, authenticated;
revoke all on function warehouse_projection.emit_daily_stock_snapshot_event()
  from public, anon, authenticated;
