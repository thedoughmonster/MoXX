-- service-owner: warehouse-read-api

create or replace view momi_api.warehouse_entities_by_id_v1
with (security_invoker = true)
as
select distinct on (version.entity_id)
  version.entity_id,
  entity.entity_type,
  version.schema_version,
  version.canonical_document,
  version.source_observed_at,
  version.projected_at,
  version.provenance,
  jsonb_build_object(
    'observed_at', version.source_observed_at,
    'projected_at', version.projected_at,
    'age_seconds', greatest(
      0, extract(epoch from now() - version.source_observed_at)::bigint
    )
  ) as freshness
from momi_warehouse.entity_versions as version
join momi_warehouse.entities as entity using (entity_id)
where entity.lifecycle_status = 'active'
order by version.entity_id,
  case when entity.entity_type in (
    'menu', 'menu_group', 'menu_item',
    'modifier_group', 'modifier_option'
  ) and version.provenance ->> 'resource_type' = 'menu'
    then 0 else 1 end,
  version.source_observed_at desc,
  version.projected_at desc,
  version.entity_version_id desc;

comment on view momi_api.warehouse_entities_by_id_v1 is
  'Latest canonical entities, preferring complete published menu documents.';

revoke all on table momi_api.warehouse_entities_by_id_v1
  from public, anon, authenticated;
