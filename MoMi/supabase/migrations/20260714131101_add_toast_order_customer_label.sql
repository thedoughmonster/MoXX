-- service-owner: toast-order-read-api

create or replace view momi_api.toast_orders_by_id_v1
with (security_invoker = true)
as
with order_rows as (
  select source.source_system, source.source_version_id,
    source.location_id, source.order_id, source.retrieved_at,
    source.content_hash, source.payload, presentation.order_presentation
  from momi_api.toast_order_source_versions_v1 as source
  join momi_api.toast_order_alert_presentations_v1 as presentation
    on presentation.source_version_id = source.source_version_id
  where source.payload ->> 'guid' = source.order_id
), check_labels as (
  select orders.source_version_id,
    left(regexp_replace(btrim(check_value ->> 'tabName'),
      '[[:cntrl:]]', ' ', 'g'), 80) as customer_label
  from order_rows as orders
  cross join lateral jsonb_array_elements(case
    when jsonb_typeof(orders.payload -> 'checks') = 'array'
      then orders.payload -> 'checks' else '[]'::jsonb end) as check_value
  where nullif(btrim(check_value ->> 'tabName'), '') is not null
    and coalesce(check_value -> 'voided', 'false'::jsonb) <> 'true'::jsonb
    and coalesce(check_value -> 'deleted', 'false'::jsonb) <> 'true'::jsonb
), customer_labels as (
  select source_version_id, left(string_agg(distinct customer_label,
    ' / ' order by customer_label), 200) as customer_label
  from check_labels
  group by source_version_id
)
select orders.source_system, orders.source_version_id, orders.location_id,
  orders.order_id, orders.retrieved_at, orders.content_hash, orders.payload,
  orders.order_presentation || jsonb_build_object(
    'customer_label', customer.customer_label) as order_presentation
from order_rows as orders
left join customer_labels as customer
  on customer.source_version_id = orders.source_version_id;

revoke all on table momi_api.toast_orders_by_id_v1
  from public, anon, authenticated;
