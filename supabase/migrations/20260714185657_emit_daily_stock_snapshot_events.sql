-- service-owner: warehouse-projection

create function warehouse_projection.emit_daily_stock_snapshot_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.operation_key <> 'toast.stock.snapshot.v1'
    or new.mode <> 'snapshot'
    or new.status <> 'succeeded'
    or old.status = 'succeeded' then return new; end if;
  if not exists (
    select 1 from toast_raw.api_request_attempts as attempt
    where attempt.job_id = new.job_id
      and attempt.http_status between 200 and 299
      and attempt.finished_at is not null
      and jsonb_typeof(attempt.response_json) = 'array'
  ) then raise exception 'daily_stock_archive_missing'; end if;
  insert into momi_events.events (
    event_name, idempotency_key, occurred_at, schema_version,
    source_system, source_resource_type, source_id,
    source_reference, correlation_id
  ) values (
    'source.toast.resource.stock_snapshot.completed',
    'toast:daily-stock-job:' || new.job_id,
    coalesce(new.completed_at, now()), 1,
    'toast', 'stock_snapshot', new.job_id::text,
    jsonb_build_object(
      'schema', 'toast_acquisition', 'table', 'jobs', 'id', new.job_id
    ), new.correlation_id
  ) on conflict (idempotency_key) do nothing;
  return new;
end;
$$;

create trigger emit_daily_stock_snapshot_event
after update of status on toast_acquisition.jobs
for each row execute function
  warehouse_projection.emit_daily_stock_snapshot_event();

revoke all on function warehouse_projection.emit_daily_stock_snapshot_event()
  from public, anon, authenticated;

create function warehouse_projection.project_toast_archived_order(
  p_observation_id bigint,
  p_correlation_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'canonical_order_projection_pending';
end;
$$;

revoke all on function warehouse_projection.project_toast_archived_order(
  bigint, uuid
) from public, anon, authenticated;
