-- service-owner: warehouse-projection

drop trigger if exists wake_warehouse_projection_worker
  on momi_events.deliveries;

update momi_runtime.function_trigger_registry
set active = false
where trigger_key = 'momi.warehouse_projection.toast.http.v1'
  and function_key = 'momi.warehouse_projection.toast.consume.v1'
  and owner_service = 'warehouse-projection';

select cron.alter_job(job_id := jobid, active := false)
from cron.job
where jobname = 'momi-warehouse-projection-wakeup-v1';

update warehouse_projection.worker_settings
set processor_mode = 'database', updated_at = now()
where subscription_key = 'warehouse-projection-toast-v1';

delete from warehouse_projection.delivery_reservations
where subscription_key = 'warehouse-projection-toast-v1';

select cron.schedule(
  'momi-warehouse-projection-database-v1',
  '3 seconds',
  'call warehouse_projection.process_delivery_batch(6, 60)'
);

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_trigger
    where tgname = 'wake_warehouse_projection_worker'
      and not tgisinternal
  ) then raise exception 'Projection HTTP trigger remains active'; end if;
  if exists (
    select 1 from momi_runtime.function_trigger_registry
    where trigger_key = 'momi.warehouse_projection.toast.http.v1'
      and active
  ) then raise exception 'Projection HTTP route remains active'; end if;
  if exists (
    select 1 from cron.job
    where jobname = 'momi-warehouse-projection-wakeup-v1' and active
  ) then raise exception 'Projection HTTP cron remains active'; end if;
  if (select count(*) from cron.job
    where jobname = 'momi-warehouse-projection-database-v1'
      and active and schedule = '3 seconds'
      and command =
        'call warehouse_projection.process_delivery_batch(6, 60)') <> 1
  then raise exception 'Database projection cron is invalid'; end if;
  if not exists (
    select 1 from warehouse_projection.worker_settings
    where subscription_key = 'warehouse-projection-toast-v1'
      and processor_mode = 'database'
  ) then raise exception 'Database processor fence is inactive'; end if;
  if exists (
    select 1 from warehouse_projection.delivery_reservations
    where subscription_key = 'warehouse-projection-toast-v1'
  ) then raise exception 'Edge reservations remain'; end if;
  if (select count(*) from cron.job
    where jobname in ('momi-event-delivery-retries-v1',
      'momi-expired-delivery-reconcile-v1') and active) <> 2
  then raise exception 'Delivery recovery jobs are inactive'; end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgname = 'rotate_projection_delivery_capability'
      and not tgisinternal and tgenabled <> 'D'
  ) then raise exception 'Capability rotation trigger is inactive'; end if;
  if not exists (
    select 1 from momi_events.subscriptions
    where subscription_key = 'warehouse-projection-toast-v1' and active
  ) then raise exception 'Projection subscription is inactive'; end if;
end;
$$;
