-- service-owner: warehouse-projection

insert into momi_warehouse.entity_versions as existing (
  entity_id, schema_version, canonical_document, content_hash,
  source_system, source_resource_type, source_id, source_version_id,
  source_observed_at, provenance
)
select replay.entity_id, 2, replay.canonical_document,
  encode(extensions.digest(replay.canonical_document::text, 'sha256'), 'hex'),
  replay.source_system, replay.resource_type, replay.source_id,
  replay.source_version_id, replay.observed_at, replay.provenance
from warehouse_projection.canonical_resource_replay_v2 as replay
on conflict (
  entity_id, source_system, source_resource_type, source_id,
  source_version_id, content_hash
) do update set
  schema_version = greatest(existing.schema_version, excluded.schema_version),
  source_observed_at = greatest(
    existing.source_observed_at, excluded.source_observed_at
  ),
  provenance = case
    when excluded.source_observed_at >= existing.source_observed_at
      then excluded.provenance else existing.provenance end;

insert into momi_warehouse.version_observations (
  source_observation_key, entity_version_id, observed_at,
  correlation_id, source_reference
)
select 'toast:resource-observation:' || observation.observation_id
    || ':canonical-resource-v2',
  version.entity_version_id, observation.observed_at,
  observation.correlation_id,
  jsonb_build_object(
    'source_system', replay.source_system,
    'resource_type', replay.resource_type,
    'source_id', replay.source_id,
    'source_version_id', replay.source_version_id,
    'source_content_hash', replay.source_content_hash,
    'projection_contract', 'canonical-resource-v2',
    'source_reference', jsonb_build_object(
      'schema', 'toast_raw', 'table', 'resource_observations',
      'id', observation.observation_id,
      'resource_version_id', replay.resource_version_id),
    'observed_at', observation.observed_at)
from warehouse_projection.canonical_resource_replay_v2 as replay
join toast_raw.resource_observations as observation
  using (resource_version_id)
join momi_warehouse.entity_versions as version
  on version.entity_id = replay.entity_id
  and version.source_system = replay.source_system
  and version.source_resource_type = replay.resource_type
  and version.source_id = replay.source_id
  and version.source_version_id = replay.source_version_id
  and version.content_hash = encode(extensions.digest(
    replay.canonical_document::text, 'sha256'), 'hex')
on conflict (source_observation_key) do nothing;

insert into momi_events.events (
  event_name, idempotency_key, entity_type, entity_id, occurred_at,
  schema_version, source_system, source_resource_type, source_id,
  source_reference, correlation_id
)
select 'warehouse.' || replay.entity_type || '.reconciled',
  'warehouse:canonical-resource-v2:' || version.entity_version_id,
  replay.entity_type, replay.entity_id, replay.observed_at, 2,
  replay.source_system, replay.resource_type, replay.source_id,
  jsonb_build_object(
    'schema', 'momi_warehouse', 'table', 'entity_versions',
    'id', version.entity_version_id),
  replay.correlation_id
from warehouse_projection.canonical_resource_replay_v2 as replay
join momi_warehouse.entity_versions as version
  on version.entity_id = replay.entity_id
  and version.source_system = replay.source_system
  and version.source_resource_type = replay.resource_type
  and version.source_id = replay.source_id
  and version.source_version_id = replay.source_version_id
  and version.content_hash = encode(extensions.digest(
    replay.canonical_document::text, 'sha256'), 'hex')
on conflict (idempotency_key) do nothing;
