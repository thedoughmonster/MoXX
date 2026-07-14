-- service-owner: toast-order-read-api

create view momi_api.toast_order_source_versions_v1
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
  'webhook:' || (event.payload ->> 'guid') as source_version_id,
  event.payload #>> '{details,restaurantGuid}' as location_id,
  event.payload #>> '{details,order,guid}' as order_id,
  event.received_at as retrieved_at,
  encode(extensions.digest(
    (event.payload #> '{details,order}')::text,
    'sha256'
  ), 'hex') as content_hash,
  event.payload #> '{details,order}' as payload
from toast_raw.order_webhook_events as event
where jsonb_typeof(event.payload #> '{details,order}') = 'object'
  and nullif(event.payload ->> 'guid', '') is not null
  and nullif(event.payload #>> '{details,restaurantGuid}', '') is not null
  and nullif(event.payload #>> '{details,order,guid}', '') is not null;

comment on view momi_api.toast_order_source_versions_v1 is
  'Exact complete Toast order versions saved by hydration or webhooks.';

revoke all on table momi_api.toast_order_source_versions_v1
  from public, anon, authenticated;
