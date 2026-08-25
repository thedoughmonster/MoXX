-- service-owner: warehouse-projection

create or replace view momi_api.toast_order_source_versions_v1
with (security_invoker = true)
as
select
  'toast'::text as source_system,
  source.id::text as source_version_id,
  source.restaurant_guid as location_id,
  source.requested_order_guid as order_id,
  source.retrieved_at,
  source.content_hash,
  source.payload
from toast_raw.orders as source
where jsonb_typeof(source.payload) = 'object'
  and source.payload ->> 'guid' = source.requested_order_guid
union all
select
  'toast'::text as source_system,
  'webhook:' || event.event_guid as source_version_id,
  event.restaurant_guid as location_id,
  event.payload #>> '{details,order,guid}' as order_id,
  event.received_at as retrieved_at,
  encode(extensions.digest(
    (event.payload #> '{details,order}')::text, 'sha256'
  ), 'hex') as content_hash,
  event.payload #> '{details,order}' as payload
from toast_raw.webhook_events as event
where jsonb_typeof(event.payload #> '{details,order}') = 'object'
  and event.subscription_key = 'orders'
  and nullif(event.restaurant_guid, '') is not null
  and nullif(event.payload #>> '{details,order,guid}', '') is not null
union all
select
  source.source_system,
  'archive:' || source.resource_version_id as source_version_id,
  source.restaurant_guid as location_id,
  source.source_id as order_id,
  source.retrieved_at,
  source.content_hash,
  source.payload
from toast_raw.resource_versions as source
where source.source_system = 'toast'
  and source.resource_type = 'order'
  and jsonb_typeof(source.payload) = 'object'
  and source.payload ->> 'guid' = source.source_id;

comment on view momi_api.toast_order_source_versions_v1 is
  'Complete Toast order versions from hydration, authenticated webhooks, or archive acquisition.';

revoke all on table momi_api.toast_order_source_versions_v1
  from public, anon, authenticated;
