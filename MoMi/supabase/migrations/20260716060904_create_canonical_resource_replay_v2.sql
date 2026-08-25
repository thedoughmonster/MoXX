-- service-owner: warehouse-projection

create view warehouse_projection.canonical_resource_replay_v2
with (security_invoker = true)
as
with latest_observation as (
  select distinct on (version.resource_version_id)
    version.resource_version_id,
    version.source_system,
    version.resource_type,
    version.restaurant_guid,
    version.source_id,
    version.source_version_id,
    version.content_hash as source_content_hash,
    version.payload,
    observation.observation_id,
    observation.observed_at,
    observation.correlation_id
  from toast_raw.resource_versions as version
  join toast_raw.resource_observations as observation
    using (resource_version_id)
  where version.source_system = 'toast'
    and version.resource_type in (
      'payment', 'job', 'shift', 'time_entry', 'dining_option',
      'menu_configuration', 'menu_group', 'menu_item',
      'modifier_group', 'pre_modifier_group', 'pre_modifier'
    )
  order by version.resource_version_id,
    observation.observed_at desc, observation.observation_id desc
)
select source.resource_version_id,
  source.source_system,
  source.resource_type,
  source.restaurant_guid,
  source.source_id,
  source.source_version_id,
  source.source_content_hash,
  source.observation_id,
  source.observed_at,
  source.correlation_id,
  entity.entity_id,
  entity.entity_type,
  location.entity_id as location_entity_id,
  warehouse_projection.canonical_resource_document_v2(
    entity.entity_id, entity.entity_type, location.entity_id,
    source.resource_type, source.payload
  ) as canonical_document,
  jsonb_build_object(
    'source_system', source.source_system,
    'resource_type', source.resource_type,
    'source_id', source.source_id,
    'source_version_id', source.source_version_id,
    'source_content_hash', source.source_content_hash,
    'projection_contract', 'canonical-resource-v2',
    'source_reference', jsonb_build_object(
      'schema', 'toast_raw', 'table', 'resource_observations',
      'id', source.observation_id,
      'resource_version_id', source.resource_version_id),
    'observed_at', source.observed_at
  ) as provenance
from latest_observation as source
join momi_warehouse.source_links as entity_link
  on entity_link.source_system = source.source_system
  and entity_link.resource_type = source.resource_type
  and entity_link.source_location_id = source.restaurant_guid
  and entity_link.source_id = source.source_id
join momi_warehouse.entities as entity
  on entity.entity_id = entity_link.entity_id
join momi_warehouse.source_links as location
  on location.source_system = source.source_system
  and location.resource_type = 'location'
  and location.source_location_id = ''
  and location.source_id = source.restaurant_guid
where entity.lifecycle_status = 'active';

comment on view warehouse_projection.canonical_resource_replay_v2 is
  'Set-based source rows for canonical resource projection revision two.';

revoke all on table warehouse_projection.canonical_resource_replay_v2
  from public, anon, authenticated;
