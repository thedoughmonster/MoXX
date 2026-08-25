-- service-owner: warehouse-projection

create function warehouse_projection.build_toast_menu_edges()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  truncate pg_temp.menu_projection_edges;

  insert into pg_temp.menu_projection_edges
  select distinct parent.entity_id, 'menu_group_ids', child.entity_id
  from pg_temp.menu_projection_nodes as parent
  cross join lateral jsonb_array_elements(case
    when jsonb_typeof(parent.source_document -> 'menuGroups') = 'array'
      then parent.source_document -> 'menuGroups' else '[]'::jsonb end)
    as reference(value)
  join pg_temp.menu_projection_nodes as child
    on child.entity_kind = 'menu_group'
    and child.source_guid = reference.value ->> 'guid'
  where parent.entity_kind in ('menu', 'menu_group')
  on conflict do nothing;

  insert into pg_temp.menu_projection_edges
  select distinct parent.entity_id, 'menu_item_ids', child.entity_id
  from pg_temp.menu_projection_nodes as parent
  cross join lateral jsonb_array_elements(case
    when jsonb_typeof(parent.source_document -> 'menuItems') = 'array'
      then parent.source_document -> 'menuItems' else '[]'::jsonb end)
    as reference(value)
  join pg_temp.menu_projection_nodes as child
    on child.entity_kind = 'menu_item'
    and child.source_guid = reference.value ->> 'guid'
  where parent.entity_kind = 'menu_group'
  on conflict do nothing;

  insert into pg_temp.menu_projection_edges
  select distinct parent.entity_id, 'modifier_group_ids', child.entity_id
  from pg_temp.menu_projection_nodes as parent
  cross join lateral jsonb_array_elements_text(case
    when jsonb_typeof(parent.source_document -> 'modifierGroupReferences')
      = 'array' then parent.source_document -> 'modifierGroupReferences'
    else '[]'::jsonb end) as reference(value)
  join pg_temp.menu_projection_nodes as child
    on child.entity_kind = 'modifier_group'
    and child.source_reference_id = reference.value
  where parent.entity_kind in ('menu_item', 'modifier_option')
  on conflict do nothing;

  insert into pg_temp.menu_projection_edges
  select distinct parent.entity_id, 'modifier_group_ids', child.entity_id
  from pg_temp.menu_projection_nodes as parent
  cross join lateral jsonb_array_elements(case
    when jsonb_typeof(parent.source_document -> 'portions') = 'array'
      then parent.source_document -> 'portions' else '[]'::jsonb end)
    as portion(value)
  cross join lateral jsonb_array_elements_text(case
    when jsonb_typeof(portion.value -> 'modifierGroupReferences') = 'array'
      then portion.value -> 'modifierGroupReferences' else '[]'::jsonb end)
    as reference(value)
  join pg_temp.menu_projection_nodes as child
    on child.entity_kind = 'modifier_group'
    and child.source_reference_id = reference.value
  where parent.entity_kind in ('menu_item', 'modifier_option')
  on conflict do nothing;

  insert into pg_temp.menu_projection_edges
  select distinct parent.entity_id, 'modifier_option_ids', child.entity_id
  from pg_temp.menu_projection_nodes as parent
  cross join lateral jsonb_array_elements_text(case when jsonb_typeof(
    parent.source_document -> 'modifierOptionReferences') = 'array'
    then parent.source_document -> 'modifierOptionReferences'
    else '[]'::jsonb end) as reference(value)
  join pg_temp.menu_projection_nodes as child
    on child.entity_kind = 'modifier_option'
    and child.source_reference_id = reference.value
  where parent.entity_kind = 'modifier_group'
  on conflict do nothing;

  insert into pg_temp.menu_projection_edges
  select distinct option.entity_id, 'menu_item_ids', item.entity_id
  from pg_temp.menu_projection_nodes as option
  join pg_temp.menu_projection_nodes as item
    on item.entity_kind = 'menu_item'
    and item.source_guid = option.source_guid
  where option.entity_kind = 'modifier_option'
  on conflict do nothing;
end;
$$;

create function warehouse_projection.staged_menu_relationships(p_entity_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  relationships jsonb;
begin
  select coalesce(jsonb_object_agg(
    grouped.relationship, grouped.child_ids order by grouped.relationship
  ), '{}'::jsonb)
  into relationships
  from (
    select edge.relationship,
      jsonb_agg(edge.child_entity_id order by edge.child_entity_id) as child_ids
    from pg_temp.menu_projection_edges as edge
    where edge.parent_entity_id = p_entity_id
    group by edge.relationship
  ) as grouped;
  return relationships;
end;
$$;

revoke all on function warehouse_projection.build_toast_menu_edges()
  from public, anon, authenticated;
revoke all on function warehouse_projection.staged_menu_relationships(uuid)
  from public, anon, authenticated;
