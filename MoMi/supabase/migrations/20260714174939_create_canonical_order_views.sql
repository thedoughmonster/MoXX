-- service-owner: warehouse-read-api

create view momi_api.warehouse_entities_by_id_v1
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
order by version.entity_id, version.source_observed_at desc,
  version.projected_at desc, version.entity_version_id desc;

create view momi_api.orders_by_id_v1
with (security_invoker = true)
as
select entity_id as order_id,
  schema_version,
  canonical_document as order_document,
  canonical_document -> 'presentation' as order_presentation,
  provenance,
  freshness
from momi_api.warehouse_entities_by_id_v1
where entity_type = 'order';

revoke all on table momi_api.warehouse_entities_by_id_v1
  from public, anon, authenticated;
revoke all on table momi_api.orders_by_id_v1
  from public, anon, authenticated;

comment on view momi_api.orders_by_id_v1 is
  'Latest source-neutral Dough Monster order document and provenance.';

create view momi_api.payments_by_id_v1 with (security_invoker = true) as
select * from momi_api.warehouse_entities_by_id_v1
where entity_type = 'payment';
create view momi_api.menu_entities_by_id_v1 with (security_invoker = true) as
select * from momi_api.warehouse_entities_by_id_v1
where entity_type in (
  'menu', 'menu_group', 'menu_item', 'modifier_group', 'modifier_option'
);
create view momi_api.employees_by_id_v1 with (security_invoker = true) as
select * from momi_api.warehouse_entities_by_id_v1
where entity_type = 'employee';
create view momi_api.schedules_by_id_v1 with (security_invoker = true) as
select * from momi_api.warehouse_entities_by_id_v1
where entity_type = 'schedule';

create view momi_api.stock_observations_latest_v1
with (security_invoker = true)
as
select distinct on (observation.item_entity_id, observation.location_entity_id)
  observation.item_entity_id,
  observation.location_entity_id,
  observation.observed_at,
  observation.stock_state,
  observation.quantity,
  observation.source_reference as provenance,
  jsonb_build_object(
    'observed_at', observation.observed_at,
    'age_seconds', greatest(
      0, extract(epoch from now() - observation.observed_at)::bigint
    )
  ) as freshness
from momi_warehouse.stock_observations as observation
order by observation.item_entity_id, observation.location_entity_id,
  observation.observed_at desc, observation.observation_id desc;

revoke all on table momi_api.payments_by_id_v1
  from public, anon, authenticated;
revoke all on table momi_api.menu_entities_by_id_v1
  from public, anon, authenticated;
revoke all on table momi_api.employees_by_id_v1
  from public, anon, authenticated;
revoke all on table momi_api.schedules_by_id_v1
  from public, anon, authenticated;
revoke all on table momi_api.stock_observations_latest_v1
  from public, anon, authenticated;
