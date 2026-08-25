-- service-owner: warehouse-projection

create temporary table location_seed on commit drop as
select source.location_id as source_id, gen_random_uuid() as entity_id,
  min(source.retrieved_at) as first_observed_at,
  max(source.retrieved_at) as last_observed_at
from momi_api.toast_orders_by_id_v1 as source
left join momi_warehouse.source_links as link
  on link.source_system = 'toast' and link.resource_type = 'location'
  and link.source_location_id = '' and link.source_id = source.location_id
where link.entity_id is null
group by source.location_id;

insert into momi_warehouse.entities (entity_id, entity_type)
select entity_id, 'location' from location_seed;

insert into momi_warehouse.source_links (
  source_system, resource_type, source_location_id, source_id,
  entity_id, first_observed_at, last_observed_at
)
select 'toast', 'location', '', source_id,
  entity_id, first_observed_at, last_observed_at
from location_seed;

create temporary table order_seed on commit drop as
select source.location_id, source.order_id as source_id,
  gen_random_uuid() as entity_id,
  min(source.retrieved_at) as first_observed_at,
  max(source.retrieved_at) as last_observed_at
from momi_api.toast_orders_by_id_v1 as source
left join momi_warehouse.source_links as link
  on link.source_system = 'toast' and link.resource_type = 'order'
  and link.source_location_id = source.location_id
  and link.source_id = source.order_id
where link.entity_id is null
group by source.location_id, source.order_id;

insert into momi_warehouse.entities (entity_id, entity_type)
select entity_id, 'order' from order_seed;

insert into momi_warehouse.source_links (
  source_system, resource_type, source_location_id, source_id,
  entity_id, first_observed_at, last_observed_at
)
select 'toast', 'order', location_id, source_id,
  entity_id, first_observed_at, last_observed_at
from order_seed;

with normalized as (
  select source.*, order_link.entity_id,
    location_link.entity_id as location_entity_id,
    jsonb_strip_nulls(jsonb_build_object(
      'id', order_link.entity_id,
      'location_id', location_link.entity_id,
      'channel', case jsonb_typeof(source.payload -> 'source')
        when 'string' then source.payload -> 'source'
        when 'object' then to_jsonb(source.payload #>> '{source,name}')
        else null end,
      'approval_status', source.payload ->> 'approvalStatus',
      'voided', source.payload -> 'voided',
      'business_date', source.payload ->> 'businessDate',
      'opened_at', source.payload ->> 'openedDate',
      'closed_at', source.payload ->> 'closedDate',
      'guest_count', source.payload -> 'numberOfGuests',
      'presentation', source.order_presentation
    )) as document
  from momi_api.toast_orders_by_id_v1 as source
  join momi_warehouse.source_links as order_link
    on order_link.source_system = 'toast'
    and order_link.resource_type = 'order'
    and order_link.source_location_id = source.location_id
    and order_link.source_id = source.order_id
  join momi_warehouse.source_links as location_link
    on location_link.source_system = 'toast'
    and location_link.resource_type = 'location'
    and location_link.source_location_id = ''
    and location_link.source_id = source.location_id
)
insert into momi_warehouse.entity_versions (
  entity_id, schema_version, canonical_document, content_hash,
  source_system, source_resource_type, source_id, source_version_id,
  source_observed_at, provenance
)
select entity_id, 1, document,
  encode(extensions.digest(document::text, 'sha256'), 'hex'),
  'toast', 'order', order_id, source_version_id, retrieved_at,
  jsonb_build_object(
    'source_system', 'toast', 'resource_type', 'order',
    'source_version_id', source_version_id,
    'source_content_hash', content_hash,
    'observed_at', retrieved_at
  )
from normalized
on conflict (
  source_system, source_resource_type, source_id,
  source_version_id, content_hash
) do nothing;

insert into momi_warehouse.version_observations (
  source_observation_key, entity_version_id,
  observed_at, correlation_id, source_reference
)
select 'toast:order-backfill:' || version.entity_version_id,
  version.entity_version_id, version.source_observed_at,
  gen_random_uuid(), version.provenance
from momi_warehouse.entity_versions as version
where version.source_system = 'toast'
  and version.source_resource_type = 'order';
