-- service-owner: warehouse-projection

create function warehouse_projection.canonical_entity_type(
  p_resource_type text
)
returns text
language sql
immutable
strict
parallel safe
security invoker
set search_path = ''
as $$
  select case p_resource_type
    when 'restaurant' then 'location'
    when 'location' then 'location'
    when 'menu' then 'menu'
    when 'menu_configuration' then 'menu'
    when 'menu_group' then 'menu_group'
    when 'menu_item' then 'menu_item'
    when 'stock_state' then 'menu_item'
    when 'catalog_item' then 'menu_item'
    when 'modifier_group' then 'modifier_group'
    when 'pre_modifier_group' then 'modifier_group'
    when 'modifier_option' then 'modifier_option'
    when 'pre_modifier' then 'modifier_option'
    when 'ordering_schedule' then 'schedule'
    when 'shift' then 'schedule'
    else case when p_resource_type ~
      '^(menu|menu_group|menu_item|modifier_group|modifier_option)_(multilocation|reference)$'
      then regexp_replace(
        p_resource_type, '_(multilocation|reference)$', ''
      ) else p_resource_type end
  end;
$$;

create or replace view momi_api.menu_entities_by_id_v1
with (security_invoker = true)
as
select * from momi_api.warehouse_entities_by_id_v1
where entity_type in (
  'menu', 'menu_group', 'menu_item',
  'modifier_group', 'modifier_option'
);

comment on view momi_api.menu_entities_by_id_v1 is
  'Latest canonical menu-universe entities with stable DM-owned types.';

revoke all on function warehouse_projection.canonical_entity_type(text)
  from public, anon, authenticated;
revoke all on table momi_api.menu_entities_by_id_v1
  from public, anon, authenticated;
