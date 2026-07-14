-- service-owner: toast-order-read-api

create or replace view momi_api.toast_orders_by_id_v1
with (security_invoker = true)
as
select
  source.source_system,
  source.source_version_id,
  source.location_id,
  source.order_id,
  source.retrieved_at,
  source.content_hash,
  source.payload,
  presentation.order_presentation
from momi_api.toast_order_source_versions_v1 as source
join momi_api.toast_order_alert_presentations_v1 as presentation
  on presentation.source_version_id = source.source_version_id
where source.payload ->> 'guid' = source.order_id;

revoke all on table momi_api.toast_orders_by_id_v1
  from public, anon, authenticated;
