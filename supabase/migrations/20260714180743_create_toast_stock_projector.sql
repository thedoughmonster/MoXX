-- service-owner: warehouse-projection

create function warehouse_projection.project_toast_stock_webhook(
  p_webhook_id bigint,
  p_correlation_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  webhook toast_raw.webhook_events;
  item_entity_id uuid;
  location_entity_id uuid;
  stock_observation_id uuid;
  state text;
begin
  select * into strict webhook
  from toast_raw.webhook_events where id = p_webhook_id;
  if webhook.subscription_key <> 'stock' then
    raise exception 'Webhook % is not stock', p_webhook_id;
  end if;
  location_entity_id := warehouse_projection.resolve_source_entity(
    'location', 'toast', 'location', '',
    webhook.payload #>> '{details,restaurantGuid}', webhook.received_at
  );
  item_entity_id := warehouse_projection.resolve_source_entity(
    'menu_item', 'toast', 'menu_item',
    webhook.payload #>> '{details,restaurantGuid}',
    webhook.payload #>> '{details,itemGuid}', webhook.received_at
  );
  state := case webhook.event_type
    when 'in_stock' then 'IN_STOCK'
    when 'low_quantity' then 'LOW_QUANTITY'
    when 'out_of_stock' then 'OUT_OF_STOCK'
    else 'UNKNOWN'
  end;
  insert into momi_warehouse.stock_observations (
    source_observation_key, item_entity_id, location_entity_id,
    observed_at, stock_state, quantity, source_system,
    source_reference, correlation_id
  ) values (
    'toast:webhook:' || webhook.event_guid,
    item_entity_id, location_entity_id, webhook.received_at, state,
    case when jsonb_typeof(webhook.payload #> '{details,quantity}') = 'number'
      then (webhook.payload #>> '{details,quantity}')::numeric else null end,
    'toast', jsonb_build_object(
      'schema', 'toast_raw', 'table', 'webhook_events', 'id', webhook.id
    ), p_correlation_id
  ) on conflict (source_observation_key) do update
    set observed_at = excluded.observed_at
  returning momi_warehouse.stock_observations.observation_id
  into stock_observation_id;
  insert into momi_events.events (
    event_name, idempotency_key, entity_type, entity_id,
    occurred_at, schema_version, source_system, source_resource_type,
    source_id, source_reference, correlation_id
  ) values (
    'warehouse.stock.observed', 'warehouse:stock:' || stock_observation_id,
    'menu_item', item_entity_id, webhook.received_at, 1,
    'toast', 'stock_state', webhook.payload #>> '{details,itemGuid}',
    jsonb_build_object(
      'schema', 'momi_warehouse', 'table', 'stock_observations',
      'id', stock_observation_id
    ), p_correlation_id
  ) on conflict (idempotency_key) do nothing;
  return 'projected';
end;
$$;

revoke all on function warehouse_projection.project_toast_stock_webhook(
  bigint, uuid
) from public, anon, authenticated;
