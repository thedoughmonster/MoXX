-- service-owner: warehouse-projection
create or replace function warehouse_projection.project_toast_resource_observation(
  p_observation_id bigint, p_correlation_id uuid)
returns text language plpgsql
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
  provenance jsonb;
  version_id uuid;
begin
  select * into strict observation
  from toast_raw.resource_observations
  where observation_id = p_observation_id;
  select * into strict source_version
  from toast_raw.resource_versions
  where resource_version_id = observation.resource_version_id;
  if source_version.resource_type = 'restaurant' and exists (
    select 1 from toast_raw.api_request_attempts as attempt
    where attempt.attempt_id = source_version.first_attempt_id
      and attempt.operation_key = 'toast.restaurants.group.v1'
  ) then
    return 'ignored_management_group_reference';
  end if;
  if source_version.resource_type = 'menu' then
    return warehouse_projection.project_toast_menu_document(p_observation_id,
      p_correlation_id);
  elsif source_version.resource_type = 'stock_state' then
    return warehouse_projection.project_toast_stock_observation(p_observation_id,
      p_correlation_id);
  elsif source_version.resource_type = 'order' then
    return warehouse_projection.project_toast_archived_order(p_observation_id,
      p_correlation_id);
  end if;
  entity_type := warehouse_projection.canonical_entity_type(
    source_version.resource_type);
  location_id := warehouse_projection.resolve_source_entity(
    'location', 'toast', 'location', '',
    source_version.restaurant_guid, observation.observed_at
  );
  if source_version.resource_type in ('restaurant', 'location') then
    entity_id := location_id;
    perform warehouse_projection.link_source_entity(
      entity_id, 'toast', source_version.resource_type,
      source_version.restaurant_guid, source_version.source_id,
      observation.observed_at
    );
  else
    entity_id := warehouse_projection.resolve_source_entity(
      entity_type, 'toast', source_version.resource_type,
      source_version.restaurant_guid, source_version.source_id,
      observation.observed_at
    );
  end if;
  canonical_document := jsonb_strip_nulls(jsonb_build_object(
    'id', entity_id,
    'entity_type', entity_type,
    'location_id', location_id,
    'name', coalesce(source_version.payload ->> 'name',
      source_version.payload ->> 'displayName'),
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
  provenance := jsonb_build_object(
    'source_system', source_version.source_system,
    'resource_type', source_version.resource_type,
    'source_id', source_version.source_id,
    'source_version_id', source_version.source_version_id,
    'source_content_hash', source_version.content_hash,
    'source_reference', jsonb_build_object(
      'schema', 'toast_raw', 'table', 'resource_observations',
      'id', observation.observation_id,
      'resource_version_id', source_version.resource_version_id
    ),
    'observed_at', observation.observed_at
  );
  version_id := warehouse_projection.record_entity_version(
    entity_id, canonical_document, source_version.resource_type,
    source_version.source_id, source_version.source_version_id,
    observation.observed_at, provenance,
    'toast:resource-observation:' || observation.observation_id,
    p_correlation_id
  );
  insert into momi_events.events (
    event_name, idempotency_key, entity_type, entity_id,
    occurred_at, schema_version, source_system, source_resource_type,
    source_id, source_reference, correlation_id
  ) values (
    'warehouse.' || entity_type || '.observed',
    'warehouse:entity-version:' || version_id,
    entity_type, entity_id, observation.observed_at, 1,
    source_version.source_system, source_version.resource_type,
    source_version.source_id, jsonb_build_object(
      'schema', 'momi_warehouse', 'table', 'entity_versions', 'id', version_id
    ), p_correlation_id
  ) on conflict (idempotency_key) do nothing;
  return 'projected';
end;
$$;
revoke all on function warehouse_projection.project_toast_resource_observation(
  bigint, uuid) from public, anon, authenticated;
