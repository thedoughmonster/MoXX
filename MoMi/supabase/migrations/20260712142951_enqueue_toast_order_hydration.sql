create function toast_hydration.enqueue_order_hydration()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into toast_hydration.order_hydration_jobs (
    source_key,
    function_key,
    restaurant_guid,
    order_guid,
    requested_source_version,
    downstream_api_contract_key,
    raw_event_id
  )
  select
    mapping.source_key,
    mapping.function_key,
    extracted.restaurant_guid,
    extracted.order_guid,
    extracted.requested_source_version,
    mapping.downstream_api_contract_key,
    new.id
  from toast_hydration.webhook_order_mappings as mapping
  join toast_hydration.api_sources as source
    on source.source_key = mapping.source_key
    and source.is_enabled
  join toast_hydration.function_registry as registered_function
    on registered_function.function_key = mapping.function_key
    and registered_function.active
  cross join lateral (
    select
      nullif(new.payload #>> mapping.restaurant_guid_path, '')
        as restaurant_guid,
      nullif(new.payload #>> mapping.order_guid_path, '')
        as order_guid,
      coalesce(
        nullif(new.payload #>> mapping.source_version_path, ''),
        nullif(new.payload #>> mapping.fallback_identity_path, '')
      ) as requested_source_version
  ) as extracted
  join toast_hydration.restaurants as restaurant
    on restaurant.source_key = mapping.source_key
    and restaurant.restaurant_guid = extracted.restaurant_guid
    and restaurant.is_enabled
  where mapping.is_enabled
    and new.payload #> mapping.event_type_path = mapping.expected_event_type
    and extracted.order_guid is not null
    and extracted.requested_source_version is not null
  on conflict (
    source_key,
    restaurant_guid,
    order_guid,
    requested_source_version
  ) do nothing;

  return new;
end;
$$;

comment on function toast_hydration.enqueue_order_hydration() is
  'Queues configured Toast order hydration only after webhook persistence.';

revoke all on function toast_hydration.enqueue_order_hydration()
  from public, anon, authenticated;

create trigger enqueue_toast_order_hydration
after insert on toast_raw.order_webhook_events
for each row execute function toast_hydration.enqueue_order_hydration();
