-- service-owner: warehouse-projection

create schema warehouse_projection;

comment on schema warehouse_projection is
  'Private source-to-canonical projection procedures.';

create function warehouse_projection.resolve_source_entity(
  p_entity_type text,
  p_source_system text,
  p_resource_type text,
  p_source_location_id text,
  p_source_id text,
  p_observed_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare resolved_id uuid;
begin
  select link.entity_id into resolved_id
  from momi_warehouse.source_links as link
  join momi_warehouse.entities as entity using (entity_id)
  where link.source_system = p_source_system
    and link.resource_type = p_resource_type
    and link.source_location_id = coalesce(p_source_location_id, '')
    and link.source_id = p_source_id
    and entity.entity_type = p_entity_type;
  if resolved_id is not null then
    update momi_warehouse.source_links
    set last_observed_at = greatest(last_observed_at, p_observed_at)
    where source_system = p_source_system and resource_type = p_resource_type
      and source_location_id = coalesce(p_source_location_id, '')
      and source_id = p_source_id;
    return resolved_id;
  end if;
  resolved_id := gen_random_uuid();
  begin
    insert into momi_warehouse.entities (entity_id, entity_type)
    values (resolved_id, p_entity_type);
    insert into momi_warehouse.source_links (
      source_system, resource_type, source_location_id, source_id,
      entity_id, first_observed_at, last_observed_at
    ) values (
      p_source_system, p_resource_type, coalesce(p_source_location_id, ''),
      p_source_id, resolved_id, p_observed_at, p_observed_at
    );
  exception when unique_violation then
    select entity_id into strict resolved_id
    from momi_warehouse.source_links
    where source_system = p_source_system and resource_type = p_resource_type
      and source_location_id = coalesce(p_source_location_id, '')
      and source_id = p_source_id;
  end;
  return resolved_id;
end;
$$;

create function warehouse_projection.record_entity_version(
  p_entity_id uuid,
  p_document jsonb,
  p_resource_type text,
  p_source_id text,
  p_source_version_id text,
  p_observed_at timestamptz,
  p_provenance jsonb,
  p_observation_key text,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare version_id uuid; document_hash text;
begin
  document_hash := encode(extensions.digest(p_document::text, 'sha256'), 'hex');
  insert into momi_warehouse.entity_versions (
    entity_id, schema_version, canonical_document, content_hash,
    source_system, source_resource_type, source_id, source_version_id,
    source_observed_at, provenance
  ) values (
    p_entity_id, 1, p_document, document_hash,
    'toast', p_resource_type, p_source_id, p_source_version_id,
    p_observed_at, p_provenance
  ) on conflict (
    source_system, source_resource_type, source_id,
    source_version_id, content_hash
  ) do update set source_observed_at = excluded.source_observed_at
  returning entity_version_id into version_id;
  insert into momi_warehouse.version_observations (
    source_observation_key, entity_version_id, observed_at,
    correlation_id, source_reference
  ) values (
    p_observation_key, version_id, p_observed_at,
    p_correlation_id, p_provenance
  ) on conflict (source_observation_key) do nothing;
  return version_id;
end;
$$;

revoke all on schema warehouse_projection from public, anon, authenticated;
revoke all on function warehouse_projection.resolve_source_entity(
  text, text, text, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function warehouse_projection.record_entity_version(
  uuid, jsonb, text, text, text, timestamptz, jsonb, text, uuid
) from public, anon, authenticated;
