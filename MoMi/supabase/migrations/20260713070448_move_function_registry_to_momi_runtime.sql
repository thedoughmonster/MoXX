drop trigger if exists wake_order_hydration_worker
  on toast_hydration.order_hydration_jobs;
drop trigger if exists wake_order_alert_worker
  on toast_hydration.order_api_invocation_work;
drop trigger if exists enqueue_slack_order_alert_delivery
  on toast_alerting.order_alert_candidates;
drop trigger if exists wake_slack_delivery_worker
  on toast_alerting.slack_delivery_work;

create schema momi_runtime;

comment on schema momi_runtime is
  'Private registry for deployable functions and durable trigger contracts.';

alter table toast_hydration.function_registry
  set schema momi_runtime;
alter table toast_hydration.function_parameter_map
  set schema momi_runtime;
alter table toast_hydration.function_trigger_registry
  set schema momi_runtime;

revoke all on schema momi_runtime from public, anon, authenticated;
revoke all on all tables in schema momi_runtime
  from public, anon, authenticated;

create or replace function toast_hydration.enqueue_order_hydration()
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
  join momi_runtime.function_registry as registered_function
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
