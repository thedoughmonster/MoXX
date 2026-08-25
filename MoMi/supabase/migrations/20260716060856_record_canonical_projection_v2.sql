-- service-owner: warehouse-projection

create or replace function warehouse_projection.record_entity_version(
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
declare
  version_id uuid;
  observed_version_id uuid;
  document_hash text;
  projection_schema_version integer;
begin
  projection_schema_version := case
    when p_provenance ->> 'projection_contract' = 'canonical-resource-v2'
      then 2 else 1 end;
  document_hash := encode(
    extensions.digest(p_document::text, 'sha256'), 'hex'
  );
  insert into momi_warehouse.entity_versions as existing (
    entity_id, schema_version, canonical_document, content_hash,
    source_system, source_resource_type, source_id, source_version_id,
    source_observed_at, provenance
  ) values (
    p_entity_id, projection_schema_version, p_document, document_hash,
    'toast', p_resource_type, p_source_id, p_source_version_id,
    p_observed_at, p_provenance
  ) on conflict (
    entity_id, source_system, source_resource_type, source_id,
    source_version_id, content_hash
  ) do update set
    schema_version = greatest(
      existing.schema_version, excluded.schema_version
    ),
    source_observed_at = greatest(
      existing.source_observed_at, excluded.source_observed_at
    ),
    provenance = case
      when excluded.source_observed_at >= existing.source_observed_at
        then excluded.provenance else existing.provenance end
  returning entity_version_id into version_id;

  insert into momi_warehouse.version_observations as existing (
    source_observation_key, entity_version_id, observed_at,
    correlation_id, source_reference
  ) values (
    p_observation_key, version_id, p_observed_at,
    p_correlation_id, p_provenance
  ) on conflict (source_observation_key) do update set
    observed_at = greatest(existing.observed_at, excluded.observed_at),
    correlation_id = case when excluded.observed_at >= existing.observed_at
      then excluded.correlation_id else existing.correlation_id end,
    source_reference = case
      when excluded.observed_at >= existing.observed_at
        then excluded.source_reference else existing.source_reference end
  where existing.entity_version_id = excluded.entity_version_id
  returning entity_version_id into observed_version_id;
  if observed_version_id is null then
    raise exception 'source_observation_version_conflict';
  end if;
  return version_id;
end;
$$;

revoke all on function warehouse_projection.record_entity_version(
  uuid, jsonb, text, text, text, timestamptz, jsonb, text, uuid
) from public, anon, authenticated;
