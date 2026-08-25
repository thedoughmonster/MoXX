-- service-owner: toast-data-acquisition

create function toast_acquisition.plan_backfill_after_first_business_date()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.first_business_date is not null
    and new.first_business_date is distinct from old.first_business_date then
    perform toast_acquisition.enqueue_historical_backfill(
      new.restaurant_guid, current_date
    );
  end if;
  return new;
end;
$$;

create trigger plan_backfill_after_first_business_date
after update of first_business_date on toast_acquisition.restaurants
for each row
execute function toast_acquisition.plan_backfill_after_first_business_date();

create function toast_acquisition.enqueue_management_group_discovery()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare management_group_guid text;
begin
  if new.resource_type <> 'restaurant' then return new; end if;
  management_group_guid := coalesce(
    nullif(new.payload #>> '{general,managementGroupGuid}', ''),
    nullif(new.payload ->> 'managementGroupGuid', ''),
    nullif(new.payload ->> 'managementGroupGUID', '')
  );
  if management_group_guid is null then return new; end if;
  insert into toast_acquisition.schedules as current_schedule (
    schedule_key, operation_key, source_key, restaurant_guid, mode,
    schedule_kind, local_run_time, parameter_defaults,
    reason, next_due_at, active
  )
  select 'toast.restaurants.group.v1:' || restaurant.source_key || ':'
      || management_group_guid || ':daily',
    operation.operation_key, restaurant.source_key, new.restaurant_guid,
    'snapshot', 'daily', time '20:23',
    jsonb_build_object('managementGroupGUID', management_group_guid),
    'Discover every restaurant in the Toast management group',
    now(), coalesce(detail_schedule.active, false)
  from toast_acquisition.operations as operation
  join toast_acquisition.restaurants as restaurant
    on restaurant.restaurant_guid = new.restaurant_guid
    and restaurant.is_enabled
  left join toast_acquisition.schedules as detail_schedule
    on detail_schedule.schedule_key = 'toast.restaurants.get.v1:'
      || restaurant.restaurant_guid || ':daily'
  where operation.operation_key = 'toast.restaurants.group.v1'
    and operation.is_enabled
  on conflict (schedule_key) do update
  set active = current_schedule.active or excluded.active;
  return new;
exception when others then
  begin
    insert into toast_acquisition.raw_processing_failures (
      source_table, source_record_id, processing_stage, restaurant_guid,
      error_sqlstate, error_message
    ) values (
      'toast_raw.resource_versions', new.resource_version_id::text,
      'enqueue_management_group_discovery', new.restaurant_guid,
      sqlstate, sqlerrm
    );
  exception when others then null;
  end;
  return new;
end;
$$;

create trigger enqueue_management_group_discovery
after insert on toast_raw.resource_versions
for each row
execute function toast_acquisition.enqueue_management_group_discovery();

revoke all on function
  toast_acquisition.plan_backfill_after_first_business_date()
  from public, anon, authenticated;
revoke all on function
  toast_acquisition.enqueue_management_group_discovery()
  from public, anon, authenticated;
