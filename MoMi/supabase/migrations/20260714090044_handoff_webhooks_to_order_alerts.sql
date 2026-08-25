-- service-owner: toast-order-ingest

drop trigger if exists enqueue_toast_order_hydration
  on toast_raw.order_webhook_events;

create function momi_orders.enqueue_toast_webhook_order_alert_work()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into momi_orders.api_invocation_work (
    source_system,
    source_work_kind,
    source_work_id,
    source_resource_kind,
    source_version_id,
    location_id,
    order_id,
    api_contract_key
  )
  select
    'toast',
    'order_webhook_event',
    extracted.event_id,
    'order',
    'webhook:' || extracted.event_id,
    extracted.location_id,
    extracted.order_id,
    mapping.downstream_api_contract_key
  from toast_hydration.webhook_order_mappings as mapping
  join toast_hydration.api_sources as source
    on source.source_key = mapping.source_key
    and source.is_enabled
  cross join lateral (
    select
      nullif(new.payload #>> mapping.fallback_identity_path, '') as event_id,
      nullif(new.payload #>> mapping.restaurant_guid_path, '') as location_id,
      nullif(new.payload #>> mapping.order_guid_path, '') as order_id
  ) as extracted
  join toast_hydration.restaurants as restaurant
    on restaurant.source_key = mapping.source_key
    and restaurant.restaurant_guid = extracted.location_id
    and restaurant.is_enabled
  join momi_api.read_view_registry as reader
    on reader.view_key = mapping.downstream_api_contract_key
    and reader.active
  where mapping.is_enabled
    and new.payload #> mapping.event_type_path = mapping.expected_event_type
    and jsonb_typeof(new.payload #> '{details,order}') = 'object'
    and extracted.event_id is not null
    and extracted.order_id is not null
  on conflict (
    source_system,
    source_resource_kind,
    source_version_id,
    api_contract_key
  ) do nothing;

  return new;
end;
$$;

comment on function momi_orders.enqueue_toast_webhook_order_alert_work() is
  'Creates owned order alert work from a complete stored Toast webhook.';

revoke all on function momi_orders.enqueue_toast_webhook_order_alert_work()
  from public, anon, authenticated;

create trigger enqueue_toast_webhook_order_alert_work
after insert on toast_raw.order_webhook_events
for each row execute function
  momi_orders.enqueue_toast_webhook_order_alert_work();
