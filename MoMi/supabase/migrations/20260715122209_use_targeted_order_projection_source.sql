-- service-owner: warehouse-projection

create or replace view momi_api.toast_order_alert_presentations_v1
with (security_invoker = true)
as
select source.source_version_id,
  warehouse_projection.toast_order_presentation_v1(source.payload)
    - 'customer_label' as order_presentation
from momi_api.toast_order_source_versions_v1 as source;

create or replace view momi_api.toast_orders_by_id_v1
with (security_invoker = true)
as
select source.source_system, source.source_version_id,
  source.location_id, source.order_id, source.retrieved_at,
  source.content_hash, source.payload,
  warehouse_projection.toast_order_presentation_v1(source.payload)
    as order_presentation
from momi_api.toast_order_source_versions_v1 as source
where source.payload ->> 'guid' = source.order_id;

comment on view momi_api.toast_order_alert_presentations_v1 is
  'One-payload Toast order presentation; filtering precedes JSON traversal.';
comment on view momi_api.toast_orders_by_id_v1 is
  'Exact Toast order versions with one-payload presentation derivation.';

revoke all on table momi_api.toast_order_alert_presentations_v1
  from public, anon, authenticated;
revoke all on table momi_api.toast_orders_by_id_v1
  from public, anon, authenticated;
