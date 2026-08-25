-- service-owner: warehouse-projection
create function warehouse_projection.project_toast_resource_observation(
  p_observation_id bigint, p_correlation_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  observation toast_raw.resource_observations;
  source_version toast_raw.resource_versions;
  entity_type text;
  entity_id uuid;
  location_id uuid;
  canonical_document jsonb;
  canonical_version_id uuid;
begin
  select * into strict observation
  from toast_raw.resource_observations where observation_id = p_observation_id;
  select * into strict source_version
  from toast_raw.resource_versions
  where resource_version_id = observation.resource_version_id;
  entity_type := case
    when source_version.resource_type = 'restaurant' then 'location'
    when source_version.resource_type in (
      'menu', 'menu_configuration', 'menu_group', 'menu_item',
      'modifier_group', 'pre_modifier_group', 'pre_modifier'
    ) then 'menu_entity'
    when source_version.resource_type in ('ordering_schedule', 'shift')
      then 'schedule'
    else source_version.resource_type
  end;
  location_id := warehouse_projection.resolve_source_entity(
    'location', 'toast', 'location', '', source_version.restaurant_guid,
    observation.observed_at
  );
  entity_id := warehouse_projection.resolve_source_entity(
    entity_type, 'toast', source_version.resource_type,
    source_version.restaurant_guid, source_version.source_id,
    observation.observed_at
  );
  if source_version.resource_type = 'stock_state' then
    insert into momi_warehouse.stock_observations (
      source_observation_key, item_entity_id, location_entity_id,
      observed_at, stock_state, quantity, source_system,
      source_reference, correlation_id
    ) values (
      'toast:resource-observation:' || observation.observation_id,
      entity_id, location_id, observation.observed_at,
      case coalesce(source_version.payload ->> 'status', 'IN_STOCK')
        when 'QUANTITY' then 'LOW_QUANTITY'
        when 'OUT_OF_STOCK' then 'OUT_OF_STOCK'
        else 'IN_STOCK' end,
      case when jsonb_typeof(source_version.payload -> 'quantity') = 'number'
        then (source_version.payload ->> 'quantity')::numeric else null end,
      'toast', jsonb_build_object(
        'schema', 'toast_raw', 'table', 'resource_observations',
        'id', observation.observation_id
      ), p_correlation_id
    ) on conflict (source_observation_key) do nothing;
    return 'projected_stock_observation';
  end if;
  canonical_document := jsonb_strip_nulls(jsonb_build_object(
    'id', entity_id,
    'entity_type', entity_type,
    'location_id', location_id,
    'name', coalesce(
      source_version.payload ->> 'name',
      source_version.payload ->> 'displayName'
    ),
    'description', source_version.payload ->> 'description',
    'status', source_version.payload ->> 'status',
    'active', source_version.payload -> 'active',
    'archived', source_version.payload -> 'archived',
    'amount', source_version.payload -> 'amount',
    'tip_amount', source_version.payload -> 'tipAmount',
    'paid_at', source_version.payload ->> 'paidDate',
    'refunded_at', source_version.payload ->> 'refundDate',
    'voided', source_version.payload -> 'voided',
    'first_name', source_version.payload ->> 'firstName',
    'last_name', source_version.payload ->> 'lastName',
    'email', source_version.payload ->> 'email',
    'phone', source_version.payload ->> 'phoneNumber',
    'starts_at', source_version.payload ->> 'startDate',
    'ends_at', source_version.payload ->> 'endDate'
  ));
  canonical_version_id := warehouse_projection.record_entity_version(
    entity_id, canonical_document, source_version.resource_type,
    source_version.source_id, source_version.source_version_id,
    observation.observed_at,
    jsonb_build_object(
      'source_system', 'toast',
      'resource_type', source_version.resource_type,
      'source_version_id', source_version.source_version_id,
      'source_content_hash', source_version.content_hash,
      'observed_at', observation.observed_at
    ), 'toast:resource-observation:' || observation.observation_id,
    p_correlation_id
  );
  insert into momi_events.events (
    event_name, idempotency_key, entity_type, entity_id,
    occurred_at, schema_version, source_system, source_resource_type,
    source_id, source_reference, correlation_id
  ) values (
    'warehouse.' || entity_type || '.observed',
    'warehouse:entity-version:' || canonical_version_id,
    entity_type, entity_id, observation.observed_at, 1,
    'toast', source_version.resource_type, source_version.source_id,
    jsonb_build_object(
      'schema', 'momi_warehouse', 'table', 'entity_versions',
      'id', canonical_version_id
    ), p_correlation_id
  ) on conflict (idempotency_key) do nothing;
  return 'projected';
end;
$$;
revoke all on function warehouse_projection.project_toast_resource_observation(
  bigint, uuid
) from public, anon, authenticated;
