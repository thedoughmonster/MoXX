-- service-owner: warehouse-projection

create function warehouse_projection.project_staged_menu_entities(
  p_observation_id bigint,
  p_correlation_id uuid,
  p_location_id uuid,
  p_source_location_id text,
  p_source_version_id text,
  p_source_content_hash text,
  p_observed_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  node record;
  canonical_document jsonb;
  provenance jsonb;
  entity_version_id uuid;
  universe_id uuid;
  raw_reference jsonb;
begin
  raw_reference := jsonb_build_object(
    'schema', 'toast_raw', 'table', 'resource_observations',
    'id', p_observation_id
  );
  for node in
    select distinct on (entity_id)
      entity_id, entity_kind, source_guid, source_document
    from pg_temp.menu_projection_nodes
    order by entity_id,
      case source_role when 'menu_item' then 0 else 1 end,
      source_document::text
  loop
    canonical_document := warehouse_projection.canonical_menu_document(
      node.entity_id, node.entity_kind, p_location_id,
      node.source_document,
      warehouse_projection.staged_menu_relationships(node.entity_id)
    );
    provenance := jsonb_build_object(
      'source_system', 'toast',
      'resource_type', 'menu',
      'source_version_id', p_source_version_id,
      'source_content_hash', p_source_content_hash,
      'source_entity', jsonb_build_object(
        'resource_type', node.entity_kind, 'source_id', node.source_guid
      ),
      'source_reference', raw_reference,
      'observed_at', p_observed_at
    );
    entity_version_id := warehouse_projection.record_entity_version(
      node.entity_id, canonical_document, node.entity_kind, node.source_guid,
      p_source_version_id, p_observed_at, provenance,
      'toast:menu-observation:' || p_observation_id || ':'
        || node.entity_kind || ':' || node.source_guid,
      p_correlation_id
    );
    insert into momi_events.events (
      event_name, idempotency_key, entity_type, entity_id,
      occurred_at, schema_version, source_system, source_resource_type,
      source_id, source_reference, correlation_id
    ) values (
      'warehouse.menu_entity.observed',
      'warehouse:entity-version:' || entity_version_id,
      node.entity_kind, node.entity_id, p_observed_at, 1,
      'toast', node.entity_kind, node.source_guid,
      jsonb_build_object(
        'schema', 'momi_warehouse', 'table', 'entity_versions',
        'id', entity_version_id
      ), p_correlation_id
    ) on conflict (idempotency_key) do nothing;
  end loop;

  insert into momi_warehouse.menu_universe_versions (
    location_entity_id, source_system, source_location_id,
    source_version_id, source_content_hash, source_reference
  ) values (
    p_location_id, 'toast', p_source_location_id,
    p_source_version_id, p_source_content_hash, raw_reference
  ) on conflict (
    source_system, source_location_id, source_version_id, source_content_hash
  ) do update set source_content_hash = excluded.source_content_hash
  returning universe_version_id into universe_id;

  insert into momi_warehouse.menu_universe_observations (
    source_observation_key, universe_version_id, observed_at,
    correlation_id, source_reference
  ) values (
    'toast:menu-universe-observation:' || p_observation_id,
    universe_id, p_observed_at, p_correlation_id, raw_reference
  ) on conflict (source_observation_key) do nothing;

  insert into momi_warehouse.menu_universe_items (
    universe_version_id, item_entity_id
  )
  select distinct universe_id, entity_id
  from pg_temp.menu_projection_nodes where entity_kind = 'menu_item'
  on conflict do nothing;
  return universe_id;
end;
$$;

revoke all on function warehouse_projection.project_staged_menu_entities(
  bigint, uuid, uuid, text, text, text, timestamptz
) from public, anon, authenticated;
