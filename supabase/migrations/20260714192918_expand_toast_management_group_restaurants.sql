-- service-owner: toast-data-acquisition

create function toast_acquisition.expand_management_group_restaurant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  archived_operation text;
  discovered_guid text;
  requester_source_key text;
  requester_enabled boolean;
  discovery_active boolean;
  requester_correlation_id uuid;
begin
  select attempt.operation_key into archived_operation
  from toast_raw.api_request_attempts as attempt
  where attempt.attempt_id = new.first_attempt_id;

  if archived_operation is distinct from 'toast.restaurants.group.v1' then
    return new;
  end if;

  if new.source_system <> 'toast'
    or new.resource_type <> 'restaurant'
    or jsonb_typeof(new.payload) <> 'object'
    or new.payload <> jsonb_build_object('guid', new.payload -> 'guid')
    or jsonb_typeof(new.payload -> 'guid') <> 'string' then
    raise exception 'Invalid normalized management-group item'
      using errcode = '22023';
  end if;

  discovered_guid := nullif(new.payload ->> 'guid', '');
  if discovered_guid is null
    or discovered_guid <> new.source_id
    or discovered_guid !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    raise exception 'Invalid management-group restaurant GUID'
      using errcode = '22023';
  end if;

  select job.source_key, requester.is_enabled, exists (
    select 1 from toast_acquisition.schedules as discovery_schedule
    where discovery_schedule.operation_key = job.operation_key
      and discovery_schedule.source_key = job.source_key
      and discovery_schedule.restaurant_guid = job.restaurant_guid
      and discovery_schedule.active
  ), job.correlation_id
  into strict requester_source_key, requester_enabled, discovery_active,
    requester_correlation_id
  from toast_raw.api_request_attempts as attempt
  join toast_acquisition.jobs as job
    on job.job_id = attempt.job_id
    and job.operation_key = attempt.operation_key
    and job.restaurant_guid = attempt.restaurant_guid
  join toast_acquisition.restaurants as requester
    on requester.source_key = job.source_key
    and requester.restaurant_guid = job.restaurant_guid
  where attempt.attempt_id = new.first_attempt_id
    and attempt.operation_key = 'toast.restaurants.group.v1'
    and attempt.restaurant_guid = new.restaurant_guid;

  insert into toast_acquisition.restaurants (
    source_key, restaurant_guid, is_enabled
  ) values (
    requester_source_key, discovered_guid, requester_enabled
  ) on conflict (source_key, restaurant_guid) do nothing;

  perform toast_acquisition.seed_restaurant_schedules(
    requester_source_key, discovered_guid,
    requester_enabled and discovery_active
  );

  insert into toast_acquisition.jobs (
    operation_key, source_key, restaurant_guid, mode, parameters,
    reason, correlation_id, idempotency_key, next_attempt_at
  )
  select operation.operation_key, discovered.source_key,
    discovered.restaurant_guid, 'snapshot',
    jsonb_build_object('restaurantGUID', discovered.restaurant_guid,
      'includeArchived', true),
    'Archive discovered Toast restaurant detail',
    requester_correlation_id,
    'toast:restaurant-detail-discovery:' || discovered.source_key || ':'
      || discovered.restaurant_guid,
    case when requester_enabled and discovery_active then now() else 'infinity'::timestamptz end
  from toast_acquisition.restaurants as discovered
  join toast_acquisition.operations as operation
    on operation.operation_key = 'toast.restaurants.get.v1'
    and operation.is_enabled
  where discovered.source_key = requester_source_key
    and discovered.restaurant_guid = discovered_guid
    and discovered.is_enabled
  on conflict (idempotency_key) do nothing;

  return new;
exception when others then
  begin
    insert into toast_acquisition.raw_processing_failures (
      source_table, source_record_id, processing_stage, restaurant_guid,
      error_sqlstate, error_message
    ) values (
      'toast_raw.resource_versions', new.resource_version_id::text,
      'expand_management_group_restaurant', new.restaurant_guid,
      sqlstate, sqlerrm
    );
  exception when others then null;
  end;
  return new;
end;
$$;

create trigger expand_toast_management_group_restaurant
after insert on toast_raw.resource_versions
for each row
execute function toast_acquisition.expand_management_group_restaurant();

revoke all on function
  toast_acquisition.expand_management_group_restaurant()
  from public, anon, authenticated;
