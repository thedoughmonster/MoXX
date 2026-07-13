create view momi_api.toast_order_alert_presentations_v1
with (security_invoker = true)
as
with recursive order_rows as (
  select source.id::text as source_version_id, source.payload
  from toast_raw.orders as source
  where jsonb_typeof(source.payload) = 'object'
), items as (
  select orders.source_version_id,
    check_value.ordinality as check_index,
    selection.ordinality as item_index,
    selection.value as selection
  from order_rows as orders
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(orders.payload -> 'checks') = 'array'
      then orders.payload -> 'checks' else '[]'::jsonb end
  ) with ordinality as check_value(value, ordinality)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(check_value.value -> 'selections') = 'array'
      then check_value.value -> 'selections' else '[]'::jsonb end
  ) with ordinality as selection(value, ordinality)
  where coalesce(selection.value -> 'voided', 'false'::jsonb)
    <> 'true'::jsonb
), modifier_tree as (
  select items.source_version_id, items.check_index, items.item_index,
    array[modifier.ordinality] as sort_path,
    1 as depth,
    modifier.value as modifier
  from items
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(items.selection -> 'modifiers') = 'array'
      then items.selection -> 'modifiers' else '[]'::jsonb end
  ) with ordinality as modifier(value, ordinality)
  where coalesce(modifier.value -> 'voided', 'false'::jsonb)
    <> 'true'::jsonb
  union all
  select parent.source_version_id, parent.check_index, parent.item_index,
    parent.sort_path || nested.ordinality,
    parent.depth + 1,
    nested.value
  from modifier_tree as parent
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(parent.modifier -> 'modifiers') = 'array'
      then parent.modifier -> 'modifiers' else '[]'::jsonb end
  ) with ordinality as nested(value, ordinality)
  where coalesce(nested.value -> 'voided', 'false'::jsonb)
    <> 'true'::jsonb
)
select orders.source_version_id,
  jsonb_build_object(
    'presentation_version', 1,
    'display_number', left(regexp_replace(coalesce(nullif(btrim(
      orders.payload ->> 'displayNumber'), ''), 'Unnumbered'),
      '[[:cntrl:]]', ' ', 'g'), 80),
    'fulfillment_at', nullif(coalesce(
      orders.payload ->> 'promisedDate',
      orders.payload ->> 'estimatedFulfillmentDate'), ''),
    'fulfillment_epoch', case when nullif(coalesce(
      orders.payload ->> 'promisedDate',
      orders.payload ->> 'estimatedFulfillmentDate'), '') is null then null
      else extract(epoch from coalesce(
        orders.payload ->> 'promisedDate',
        orders.payload ->> 'estimatedFulfillmentDate')::timestamptz)::bigint end,
    'item_count', coalesce((select sum(case
      when jsonb_typeof(item.selection -> 'quantity') = 'number'
        then (item.selection ->> 'quantity')::numeric else 1 end)
      from items as item
      where item.source_version_id = orders.source_version_id), 0),
    'total_amount', (select sum(case
      when jsonb_typeof(check_value -> 'totalAmount') = 'number'
        then (check_value ->> 'totalAmount')::numeric else 0 end)
      from jsonb_array_elements(case
        when jsonb_typeof(orders.payload -> 'checks') = 'array'
          then orders.payload -> 'checks' else '[]'::jsonb end) as check_value
      where coalesce(check_value -> 'voided', 'false'::jsonb)
        <> 'true'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'name', left(regexp_replace(coalesce(nullif(btrim(
        item.selection ->> 'displayName'), ''), 'Unnamed item'),
        '[[:cntrl:]]', ' ', 'g'), 200),
      'quantity', case when jsonb_typeof(item.selection -> 'quantity') = 'number'
        then (item.selection ->> 'quantity')::numeric else 1 end,
      'modifiers', coalesce((select jsonb_agg(jsonb_build_object(
        'name', left(regexp_replace(coalesce(nullif(btrim(
          modifier.modifier ->> 'displayName'), ''), 'Unnamed modifier'),
          '[[:cntrl:]]', ' ', 'g'), 200),
        'quantity', case when jsonb_typeof(modifier.modifier -> 'quantity') = 'number'
          then (modifier.modifier ->> 'quantity')::numeric else 1 end,
        'depth', modifier.depth) order by modifier.sort_path)
        from modifier_tree as modifier
        where modifier.source_version_id = item.source_version_id
          and modifier.check_index = item.check_index
          and modifier.item_index = item.item_index), '[]'::jsonb)
    ) order by item.check_index, item.item_index)
    from items as item
    where item.source_version_id = orders.source_version_id), '[]'::jsonb)
  ) as order_presentation
from order_rows as orders;

create or replace view momi_api.toast_orders_by_id_v1
with (security_invoker = true)
as
select 'toast'::text as source_system,
  source.id::text as source_version_id,
  source.restaurant_guid as location_id,
  source.requested_order_guid as order_id,
  source.retrieved_at, source.content_hash, source.payload,
  presentation.order_presentation
from toast_raw.orders as source
join momi_api.toast_order_alert_presentations_v1 as presentation
  on presentation.source_version_id = source.id::text
where jsonb_typeof(source.payload) = 'object'
  and source.payload ->> 'guid' = source.requested_order_guid;

revoke all on table momi_api.toast_order_alert_presentations_v1
  from public, anon, authenticated;
revoke all on table momi_api.toast_orders_by_id_v1
  from public, anon, authenticated;
