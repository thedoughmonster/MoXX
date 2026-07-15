-- service-owner: momi-event-routing

update momi_runtime.function_registry as registry
set active = true
from (values
  ('momi.events.route.v1', 'momi-event-routing'),
  ('momi.warehouse_projection.toast.consume.v1', 'warehouse-projection'),
  ('momi.orders.get_by_id.v1', 'warehouse-read-api'),
  ('momi.employees.get_by_id.v1', 'warehouse-read-api'),
  ('momi.menu_entities.get_by_id.v1', 'warehouse-read-api'),
  ('momi.payments.get_by_id.v1', 'warehouse-read-api'),
  ('momi.schedules.get_by_id.v1', 'warehouse-read-api'),
  ('momi.stock_observations.get_latest.v1', 'warehouse-read-api')
) as expected(function_key, owner_service)
where registry.function_key = expected.function_key
  and registry.owner_service = expected.owner_service;

update momi_runtime.function_trigger_registry as trigger
set active = true
from (values
  ('momi.events.route.http.v1', 'momi-event-routing'),
  ('momi.warehouse_projection.toast.http.v1', 'warehouse-projection'),
  ('momi.orders.get_by_id.http.v1', 'warehouse-read-api'),
  ('momi.employees.get_by_id.http.v1', 'warehouse-read-api'),
  ('momi.menu_entities.get_by_id.http.v1', 'warehouse-read-api'),
  ('momi.payments.get_by_id.http.v1', 'warehouse-read-api'),
  ('momi.schedules.get_by_id.http.v1', 'warehouse-read-api'),
  ('momi.stock_observations.get_latest.http.v1', 'warehouse-read-api')
) as expected(trigger_key, owner_service)
where trigger.trigger_key = expected.trigger_key
  and trigger.owner_service = expected.owner_service;

update momi_events.subscriptions
set active = true
where subscription_key = 'warehouse-projection-toast-v1'
  and consumer_service = 'warehouse-projection'
  and event_pattern = 'source.toast.%';

select cron.alter_job(job_id := jobid, active := true)
from cron.job
where jobname in (
  'momi-event-routing-wakeup-v1',
  'momi-warehouse-projection-wakeup-v1',
  'momi-expired-delivery-reconcile-v1',
  'momi-event-delivery-retries-v1'
);

do $$
begin
  if (select count(*) from momi_runtime.function_registry
    where active and function_key in (
      'momi.events.route.v1',
      'momi.warehouse_projection.toast.consume.v1',
      'momi.orders.get_by_id.v1', 'momi.employees.get_by_id.v1',
      'momi.menu_entities.get_by_id.v1', 'momi.payments.get_by_id.v1',
      'momi.schedules.get_by_id.v1',
      'momi.stock_observations.get_latest.v1'
    )) <> 8 then raise exception 'Warehouse backbone functions are incomplete'; end if;
  if (select count(*) from momi_runtime.function_trigger_registry
    where active and owner_service in (
      'momi-event-routing', 'warehouse-projection', 'warehouse-read-api'
    )) <> 8 then raise exception 'Warehouse backbone routes are incomplete'; end if;
  if not exists (select 1 from momi_events.subscriptions
    where subscription_key = 'warehouse-projection-toast-v1' and active)
  then raise exception 'Warehouse projection subscription is inactive'; end if;
  if (select count(*) from cron.job where active and jobname in (
    'momi-event-routing-wakeup-v1',
    'momi-warehouse-projection-wakeup-v1',
    'momi-expired-delivery-reconcile-v1',
    'momi-event-delivery-retries-v1'
  )) <> 4 then raise exception 'Warehouse backbone recovery jobs are incomplete'; end if;
  if exists (select 1 from momi_events.subscriptions
    where subscription_key = 'order-alerting-v1' and active)
    or exists (select 1 from toast_acquisition.schedules where active)
    or exists (select 1 from cron.job where active and jobname in (
      'momi-toast-acquisition-due-v1', 'momi-order-alert-event-wakeup-v1'
    )) then raise exception 'A later activation stage was enabled early'; end if;
end;
$$;
