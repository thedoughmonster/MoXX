-- service-owner: warehouse-projection

create or replace function warehouse_projection.project_toast_resource_observation(
  p_observation_id bigint,
  p_correlation_id uuid
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
  provenance jsonb;
  version_id uuid;
  observation_key text;
  projection_contract text;
begin
  select * into strict observation from toast_raw.resource_observations
  where observation_id = p_observation_id;
  select * into strict source_version from toast_raw.resource_versions
  where resource_version_id = observation.resource_version_id;
  if source_version.resource_type = 'restaurant' and exists (
    select 1 from toast_raw.api_request_attempts as attempt
    where attempt.attempt_id = source_version.first_attempt_id
      and attempt.operation_key = 'toast.restaurants.group.v1'
  ) then return 'ignored_management_group_reference'; end if;
  if source_version.resource_type = 'menu' then
    return warehouse_projection.project_toast_menu_document(
      p_observation_id, p_correlation_id);
  elsif source_version.resource_type = 'stock_state' then
    return warehouse_projection.project_toast_stock_observation(
      p_observation_id, p_correlation_id);
  elsif source_version.resource_type = 'order' then
    return warehouse_projection.project_toast_archived_order(
      p_observation_id, p_correlation_id);
  end if;

  entity_type := warehouse_projection.canonical_entity_type(
    source_version.resource_type);
  location_id := warehouse_projection.resolve_source_entity(
    'location', 'toast', 'location', '', source_version.restaurant_guid,
    observation.observed_at);
  if source_version.resource_type in ('restaurant', 'location') then
    entity_id := location_id;
    perform warehouse_projection.link_source_entity(
      entity_id, 'toast', source_version.resource_type,
      source_version.restaurant_guid, source_version.source_id,
      observation.observed_at);
  else
    entity_id := warehouse_projection.resolve_source_entity(
      entity_type, 'toast', source_version.resource_type,
      source_version.restaurant_guid, source_version.source_id,
      observation.observed_at);
  end if;

  if source_version.resource_type = 'ordering_schedule' then
    canonical_document :=
      warehouse_projection.canonical_toast_ordering_schedule_document(
        source_version.payload, entity_id, location_id);
    projection_contract := 'canonical-ordering-schedule-v1';
    observation_key := 'toast:resource-observation:'
      || observation.observation_id || ':ordering-schedule-v1';
  else
    canonical_document :=
      warehouse_projection.canonical_resource_document_v2(
        entity_id, entity_type, location_id,
        source_version.resource_type, source_version.payload);
    projection_contract := 'canonical-resource-v2';
    observation_key := 'toast:resource-observation:'
      || observation.observation_id || ':canonical-resource-v2';
  end if;
  provenance := jsonb_build_object(
    'source_system', source_version.source_system,
    'resource_type', source_version.resource_type,
    'source_id', source_version.source_id,
    'source_version_id', source_version.source_version_id,
    'source_content_hash', source_version.content_hash,
    'projection_contract', projection_contract,
    'source_reference', jsonb_build_object(
      'schema', 'toast_raw', 'table', 'resource_observations',
      'id', observation.observation_id,
      'resource_version_id', source_version.resource_version_id),
    'observed_at', observation.observed_at);
  version_id := warehouse_projection.record_entity_version(
    entity_id, canonical_document, source_version.resource_type,
    source_version.source_id, source_version.source_version_id,
    observation.observed_at, provenance, observation_key, p_correlation_id);
  insert into momi_events.events (
    event_name, idempotency_key, entity_type, entity_id, occurred_at,
    schema_version, source_system, source_resource_type, source_id,
    source_reference, correlation_id
  ) values (
    'warehouse.' || entity_type || '.observed',
    'warehouse:entity-version:' || version_id, entity_type, entity_id,
    observation.observed_at,
    case when projection_contract = 'canonical-resource-v2' then 2 else 1 end,
    source_version.source_system, source_version.resource_type,
    source_version.source_id, jsonb_build_object(
      'schema', 'momi_warehouse', 'table', 'entity_versions', 'id', version_id
    ), p_correlation_id
  ) on conflict (idempotency_key) do nothing;
  return 'projected';
end;
$$;

revoke all on function warehouse_projection.project_toast_resource_observation(
  bigint, uuid
) from public, anon, authenticated;
