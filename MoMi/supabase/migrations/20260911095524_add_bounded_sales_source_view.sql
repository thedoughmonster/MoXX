-- service-owner: warehouse-projection

create view warehouse_projection.sales_source_entities_v1
with (security_barrier = true) as
select entity.entity_type,
  case when entity.entity_type = 'location' then entity.entity_id
    else (latest.canonical_document ->> 'location_id')::uuid end as location_id,
  (latest.canonical_document ->> 'business_date')::date as business_date,
  (latest.canonical_document ->> 'opened_at')::timestamptz as opened_at,
  (latest.canonical_document ->> 'submitted_at')::timestamptz as submitted_at,
  (latest.canonical_document ->> 'voided')::boolean as voided,
  (latest.canonical_document #>> '{presentation,total_amount}')::numeric as total_amount,
  latest.canonical_document ->> 'channel' as channel,
  latest.canonical_document ->> 'channel_kind' as channel_kind,
  latest.source_observed_at
from momi_warehouse.entities as entity
cross join lateral (
  select version.canonical_document, version.source_observed_at
  from momi_warehouse.entity_versions as version
  where version.entity_id = entity.entity_id
  order by version.source_observed_at desc, version.projected_at desc,
    version.entity_version_id desc
  limit 1
) as latest
where entity.lifecycle_status = 'active'
  and entity.entity_type in ('order', 'location');

revoke all on warehouse_projection.sales_source_entities_v1
  from public, anon, authenticated, service_role;
grant select on warehouse_projection.sales_source_entities_v1
  to svc_warehouse_read_api;

comment on view warehouse_projection.sales_source_entities_v1 is
  'Canonical read contract: latest active order/location sales fields, selected with existing entity/version indexes. No source fetches or raw documents.';
