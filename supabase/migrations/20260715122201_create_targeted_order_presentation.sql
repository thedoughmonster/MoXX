-- service-owner: warehouse-projection

create function warehouse_projection.toast_order_presentation_v1(p_payload jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  with recursive items as (
    select check_value.ordinality as check_index,
      selection.ordinality as item_index, selection.value as selection
    from jsonb_array_elements(case
      when jsonb_typeof(p_payload -> 'checks') = 'array'
        then p_payload -> 'checks' else '[]'::jsonb end
    ) with ordinality as check_value(value, ordinality)
    cross join lateral jsonb_array_elements(case
      when jsonb_typeof(check_value.value -> 'selections') = 'array'
        then check_value.value -> 'selections' else '[]'::jsonb end
    ) with ordinality as selection(value, ordinality)
    where coalesce(selection.value -> 'voided', 'false'::jsonb)
      <> 'true'::jsonb
  ), modifier_tree as (
    select item.check_index, item.item_index,
      array[modifier.ordinality] as sort_path, 1 as depth,
      modifier.value as modifier
    from items as item
    cross join lateral jsonb_array_elements(case
      when jsonb_typeof(item.selection -> 'modifiers') = 'array'
        then item.selection -> 'modifiers' else '[]'::jsonb end
    ) with ordinality as modifier(value, ordinality)
    where coalesce(modifier.value -> 'voided', 'false'::jsonb)
      <> 'true'::jsonb
    union all
    select parent.check_index, parent.item_index,
      parent.sort_path || nested.ordinality, parent.depth + 1, nested.value
    from modifier_tree as parent
    cross join lateral jsonb_array_elements(case
      when jsonb_typeof(parent.modifier -> 'modifiers') = 'array'
        then parent.modifier -> 'modifiers' else '[]'::jsonb end
    ) with ordinality as nested(value, ordinality)
    where coalesce(nested.value -> 'voided', 'false'::jsonb)
      <> 'true'::jsonb
  ), customer_labels as (
    select left(string_agg(distinct label, ' / ' order by label), 200)
      as customer_label
    from (
      select left(regexp_replace(btrim(value ->> 'tabName'),
        '[[:cntrl:]]', ' ', 'g'), 80) as label
      from jsonb_array_elements(case
        when jsonb_typeof(p_payload -> 'checks') = 'array'
          then p_payload -> 'checks' else '[]'::jsonb end) as value
      where nullif(btrim(value ->> 'tabName'), '') is not null
        and coalesce(value -> 'voided', 'false'::jsonb) <> 'true'::jsonb
        and coalesce(value -> 'deleted', 'false'::jsonb) <> 'true'::jsonb
    ) as labels
  )
  select jsonb_build_object(
    'presentation_version', 1,
    'display_number', left(regexp_replace(coalesce(nullif(btrim(
      p_payload ->> 'displayNumber'), ''), 'Unnumbered'),
      '[[:cntrl:]]', ' ', 'g'), 80),
    'fulfillment_at', nullif(coalesce(p_payload ->> 'promisedDate',
      p_payload ->> 'estimatedFulfillmentDate'), ''),
    'fulfillment_epoch', case when nullif(coalesce(
      p_payload ->> 'promisedDate',
      p_payload ->> 'estimatedFulfillmentDate'), '') is null then null
      else extract(epoch from coalesce(p_payload ->> 'promisedDate',
        p_payload ->> 'estimatedFulfillmentDate')::timestamptz)::bigint end,
    'item_count', coalesce((select sum(case
      when jsonb_typeof(item.selection -> 'quantity') = 'number'
        then (item.selection ->> 'quantity')::numeric else 1 end)
      from items as item), 0),
    'total_amount', (select sum(case
      when jsonb_typeof(value -> 'totalAmount') = 'number'
        then (value ->> 'totalAmount')::numeric else 0 end)
      from jsonb_array_elements(case
        when jsonb_typeof(p_payload -> 'checks') = 'array'
          then p_payload -> 'checks' else '[]'::jsonb end) as value
      where coalesce(value -> 'voided', 'false'::jsonb) <> 'true'::jsonb),
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
        where modifier.check_index = item.check_index
          and modifier.item_index = item.item_index), '[]'::jsonb)
    ) order by item.check_index, item.item_index)
    from items as item), '[]'::jsonb)
  ) || jsonb_build_object('customer_label',
    (select customer_label from customer_labels));
$$;

revoke all on function warehouse_projection.toast_order_presentation_v1(jsonb)
  from public, anon, authenticated;
