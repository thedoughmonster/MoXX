-- service-owner: warehouse-projection

create function warehouse_projection.canonical_menu_sales_channels(
  p_visibility jsonb
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(channel order by channel), '[]'::jsonb)
  from (
    select distinct case source.value
      when 'POS' then 'point_of_sale'
      when 'KIOSK' then 'kiosk'
      when 'TOAST_ONLINE_ORDERING' then 'direct_online'
      when 'ORDERING_PARTNERS' then 'partner_online'
      when 'GRUBHUB' then 'partner_online'
      else null end as channel
    from jsonb_array_elements_text(case
      when jsonb_typeof(p_visibility) = 'array'
        then p_visibility else '[]'::jsonb end) as source(value)
  ) as normalized
  where channel is not null;
$$;

create function warehouse_projection.canonical_menu_document(
  p_entity_id uuid,
  p_entity_kind text,
  p_location_id uuid,
  p_source jsonb,
  p_relationships jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare image_urls jsonb; tag_names jsonb;
begin
  image_urls := case
    when jsonb_typeof(p_source -> 'images') = 'array'
      and jsonb_array_length(p_source -> 'images') > 0
      then p_source -> 'images'
    when nullif(p_source ->> 'highResImage', '') is not null
      then jsonb_build_array(p_source ->> 'highResImage')
    when nullif(p_source ->> 'image', '') is not null
      then jsonb_build_array(p_source ->> 'image')
    else '[]'::jsonb end;
  select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
  into tag_names from (
    select distinct nullif(tag.value ->> 'name', '') as name
    from jsonb_array_elements(case
      when jsonb_typeof(p_source -> 'itemTags') = 'array'
        then p_source -> 'itemTags' else '[]'::jsonb end) as tag(value)
  ) as names where name is not null;
  return jsonb_strip_nulls(jsonb_build_object(
    'id', p_entity_id,
    'entity_type', p_entity_kind,
    'location_id', p_location_id,
    'active', true,
    'name', nullif(p_source ->> 'name', ''),
    'display_name', nullif(p_source ->> 'posName', ''),
    'kitchen_name', nullif(p_source ->> 'kitchenName', ''),
    'description', nullif(p_source ->> 'description', ''),
    'image_urls', image_urls,
    'sales_channels', warehouse_projection.canonical_menu_sales_channels(
      p_source -> 'visibility'
    ),
    'tag_names', tag_names,
    'price_amount', case when jsonb_typeof(p_source -> 'price') = 'number'
      then p_source -> 'price' else null end,
    'pricing_model', lower(nullif(p_source ->> 'pricingStrategy', '')),
    'sku', nullif(p_source ->> 'sku', ''),
    'plu', nullif(p_source ->> 'plu', ''),
    'calories', case when jsonb_typeof(p_source -> 'calories') = 'number'
      then p_source -> 'calories' else null end,
    'discountable', p_source -> 'isDiscountable',
    'deferred_revenue', p_source -> 'isDeferred',
    'default_selection', p_source -> 'isDefault',
    'duplicate_selection_allowed', p_source -> 'allowsDuplicates',
    'minimum_selections', p_source -> 'minSelections',
    'maximum_selections', p_source -> 'maxSelections',
    'multiple_selection_allowed', p_source -> 'isMultiSelect',
    'selection_requirement', lower(nullif(p_source ->> 'requiredMode', '')),
    'unit_of_measure', lower(nullif(p_source ->> 'unitOfMeasure', '')),
    'sort_order', p_source -> 'sortOrder'
  ) || coalesce(p_relationships, '{}'::jsonb));
end;
$$;

revoke all on function warehouse_projection.canonical_menu_sales_channels(jsonb)
  from public, anon, authenticated;
revoke all on function warehouse_projection.canonical_menu_document(
  uuid, text, uuid, jsonb, jsonb
) from public, anon, authenticated;
