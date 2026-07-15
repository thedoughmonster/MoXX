-- service-owner: toast-data-acquisition

create function toast_acquisition.seed_restaurant_schedules(
  p_source_key text, p_restaurant_guid text,
  p_active boolean default false
)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  insert into toast_acquisition.schedules (
    schedule_key, operation_key, source_key, restaurant_guid, mode,
    schedule_kind, interval_seconds, window_key, reason, next_due_at, active
  )
  select operation_key || ':' || p_restaurant_guid || ':live', operation_key,
    p_source_key, p_restaurant_guid, 'live', 'interval', interval_seconds,
    window_key, reason, now(), p_active
  from (values
    ('toast.stock.snapshot.v1', 60, 'toast:' || p_restaurant_guid || ':online-ordering', 'Live stock observation'),
    ('toast.availability.snapshot.v1', 600, 'toast:' || p_restaurant_guid || ':online-ordering', 'Live availability reconciliation'),
    ('toast.menus.metadata.v1', 1800, null, 'Published menu timestamp check')
  ) as live(operation_key, interval_seconds, window_key, reason)
  on conflict (schedule_key) do nothing;

  insert into toast_acquisition.schedules (
    schedule_key, operation_key, source_key, restaurant_guid, mode,
    schedule_kind, local_run_time, parameter_defaults,
    reason, next_due_at, active
  ) values (
    'toast.restaurants.get.v1:' || p_restaurant_guid || ':daily',
    'toast.restaurants.get.v1', p_source_key, p_restaurant_guid, 'snapshot',
    'daily', time '20:24', jsonb_build_object(
      'restaurantGUID', p_restaurant_guid, 'includeArchived', true),
    'Daily restaurant detail and first business date', now(), p_active
  ) on conflict (schedule_key) do nothing;

  insert into toast_acquisition.schedules (
    schedule_key, operation_key, source_key, restaurant_guid, mode,
    schedule_kind, local_run_time, parameter_defaults,
    window_lookback_seconds, reason, next_due_at, active
  )
  select operation_key || ':' || p_restaurant_guid || ':daily'
      || case when schedule_variant is null then '' else ':' || schedule_variant end,
    operation_key, p_source_key, p_restaurant_guid, 'snapshot', 'daily',
    run_time, parameter_defaults, lookback_seconds, reason, now(), p_active
  from (values
    ('toast.menus.full.v1', null, time '16:00', '{}'::jsonb, null::integer, 'Daily menu fallback'),
    ('toast.menus.metadata.v1', null, time '16:00', '{}'::jsonb, null, 'Daily menu metadata fallback'),
    ('toast.packaging.snapshot.v1', null, time '16:05', '{}'::jsonb, null, 'Daily packaging fallback'),
    ('toast.availability.snapshot.v1', null, time '16:05', '{}'::jsonb, null, 'Daily availability fallback'),
    ('toast.ordering_schedule.snapshot.v1', null, time '16:05', '{}'::jsonb, null, 'Daily ordering schedule fallback'),
    ('toast.stock.snapshot.v1', null, time '16:10', '{}'::jsonb, null, 'Daily all-item stock reconciliation'),
    ('toast.orders.bulk.v1', null, time '20:00', '{}'::jsonb, 172800, 'After-close order reconciliation'),
    ('toast.payments.list.v1', 'paidBusinessDate', time '20:15', '{"date_selector":"paidBusinessDate"}'::jsonb, 172800, 'Paid payment reconciliation'),
    ('toast.payments.list.v1', 'refundBusinessDate', time '20:16', '{"date_selector":"refundBusinessDate"}'::jsonb, 172800, 'Refund payment reconciliation'),
    ('toast.payments.list.v1', 'voidBusinessDate', time '20:17', '{"date_selector":"voidBusinessDate"}'::jsonb, 172800, 'Void payment reconciliation'),
    ('toast.cash.entries.v1', null, time '20:20', '{}'::jsonb, 172800, 'After-close cash entries'),
    ('toast.cash.deposits.v1', null, time '20:21', '{}'::jsonb, 172800, 'After-close cash deposits'),
    ('toast.devices.snapshot.v1', null, time '20:25', '{}'::jsonb, null, 'Daily device snapshot'),
    ('toast.kitchen.fulfillments.v1', null, time '20:26', '{}'::jsonb, 172800, 'Daily kitchen fulfillment'),
    ('toast.kitchen.prep_stations.v1', null, time '20:27', '{}'::jsonb, null, 'Daily prep stations'),
    ('toast.labor.employees.v1', null, time '20:28', '{}'::jsonb, null, 'Daily employees'),
    ('toast.labor.jobs.v1', null, time '20:29', '{}'::jsonb, null, 'Daily jobs'),
    ('toast.labor.shifts.v1', null, time '20:30', '{}'::jsonb, 3888000, 'Recent shift rescan'),
    ('toast.labor.time_entries.v1', null, time '20:31', '{"includeMissedBreaks":true}'::jsonb, 259200, 'Modified time entry rescan')
  ) as daily(operation_key, schedule_variant, run_time,
    parameter_defaults, lookback_seconds, reason)
  on conflict (schedule_key) do nothing;

  insert into toast_acquisition.schedules (
    schedule_key, operation_key, source_key, restaurant_guid, mode,
    schedule_kind, local_run_time, day_of_month, parameter_defaults,
    reason, next_due_at, active
  ) values ('toast.labor.shifts.v1:' || p_restaurant_guid || ':monthly',
    'toast.labor.shifts.v1', p_source_key, p_restaurant_guid, 'reconcile',
    'monthly', time '21:00', 1, '{"window_policy":"first_business_date"}',
    'Monthly complete shift rescan', now(), p_active)
  on conflict (schedule_key) do nothing;

  insert into toast_acquisition.schedules (
    schedule_key, operation_key, source_key, restaurant_guid, mode,
    schedule_kind, local_run_time, reason, next_due_at, active
  )
  select operation_key || ':' || p_restaurant_guid || ':daily-full',
    operation_key, p_source_key, p_restaurant_guid, 'snapshot',
    'daily', time '20:40', 'Daily full configuration sweep', now(), p_active
  from toast_acquisition.operations
  where is_enabled and operation_key like 'toast.config.%.list.v1'
  on conflict (schedule_key) do nothing;
end;
$$;

select toast_acquisition.seed_restaurant_schedules(
  source_key, restaurant_guid, false)
from toast_acquisition.restaurants where is_enabled;

revoke all on function toast_acquisition.seed_restaurant_schedules(text, text, boolean)
  from public, anon, authenticated;
