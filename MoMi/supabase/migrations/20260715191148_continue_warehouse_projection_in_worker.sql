-- service-owner: warehouse-projection

alter table warehouse_projection.worker_settings
  add column worker_max_runtime_seconds integer not null default 400,
  add column worker_max_deliveries integer not null default 500,
  add column handoff_reserve_seconds integer not null default 30,
  add column shutdown_margin_seconds integer not null default 10,
  add constraint worker_settings_runtime_valid check (
    worker_max_runtime_seconds between 60 and 400
    and worker_max_deliveries between 1 and 500
    and handoff_reserve_seconds between 5 and 120
    and shutdown_margin_seconds between 5 and 60
    and handoff_reserve_seconds + shutdown_margin_seconds
      < worker_max_runtime_seconds
  );

alter table warehouse_projection.delivery_reservations
  add column dispatch_mode text not null default 'http'
    check (dispatch_mode in ('http', 'internal'));

comment on column warehouse_projection.delivery_reservations.dispatch_mode is
  'Distinguishes external recovery wakes from same-worker exact handoffs.';

do $$
begin
  if not exists (
    select 1 from warehouse_projection.worker_settings
    where subscription_key = 'warehouse-projection-toast-v1'
      and worker_max_runtime_seconds = 400
      and worker_max_deliveries = 500
  ) then raise exception 'Projection worker envelope is invalid'; end if;
end;
$$;
