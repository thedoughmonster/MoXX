-- service-owner: warehouse-projection

create function warehouse_projection.stage_toast_menu_nodes(p_payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  create temporary table if not exists menu_projection_nodes (
    entity_kind text not null,
    source_guid text not null,
    source_multi_location_id text,
    source_reference_id text,
    root_menu_guid text,
    parent_group_guid text,
    source_role text not null,
    source_document jsonb not null,
    entity_id uuid
  ) on commit drop;
  create temporary table if not exists menu_projection_edges (
    parent_entity_id uuid not null,
    relationship text not null,
    child_entity_id uuid not null,
    primary key (parent_entity_id, relationship, child_entity_id)
  ) on commit drop;
  truncate pg_temp.menu_projection_nodes, pg_temp.menu_projection_edges;

  insert into pg_temp.menu_projection_nodes (
    entity_kind, source_guid, source_multi_location_id,
    root_menu_guid, source_role, source_document
  )
  select 'menu', menu.value ->> 'guid',
    nullif(menu.value ->> 'multiLocationId', ''),
    menu.value ->> 'guid', 'menu', menu.value
  from jsonb_array_elements(case
    when jsonb_typeof(p_payload -> 'menus') = 'array'
      then p_payload -> 'menus' else '[]'::jsonb end) as menu(value)
  where nullif(menu.value ->> 'guid', '') is not null;

  with recursive group_tree as (
    select menu.value ->> 'guid' as root_menu_guid,
      null::text as parent_group_guid, child.value as source_document
    from jsonb_array_elements(case
      when jsonb_typeof(p_payload -> 'menus') = 'array'
        then p_payload -> 'menus' else '[]'::jsonb end) as menu(value)
    cross join lateral jsonb_array_elements(case
      when jsonb_typeof(menu.value -> 'menuGroups') = 'array'
        then menu.value -> 'menuGroups' else '[]'::jsonb end) as child(value)
    union all
    select tree.root_menu_guid, tree.source_document ->> 'guid', child.value
    from group_tree as tree
    cross join lateral jsonb_array_elements(case
      when jsonb_typeof(tree.source_document -> 'menuGroups') = 'array'
        then tree.source_document -> 'menuGroups' else '[]'::jsonb end)
      as child(value)
  )
  insert into pg_temp.menu_projection_nodes (
    entity_kind, source_guid, source_multi_location_id,
    root_menu_guid, parent_group_guid, source_role, source_document
  )
  select 'menu_group', source_document ->> 'guid',
    nullif(source_document ->> 'multiLocationId', ''),
    root_menu_guid, parent_group_guid, 'menu_group', source_document
  from group_tree where nullif(source_document ->> 'guid', '') is not null;

  insert into pg_temp.menu_projection_nodes (
    entity_kind, source_guid, source_multi_location_id,
    root_menu_guid, parent_group_guid, source_role, source_document
  )
  select 'menu_item', item.value ->> 'guid',
    nullif(item.value ->> 'multiLocationId', ''),
    parent.root_menu_guid, parent.source_guid, 'menu_item', item.value
  from pg_temp.menu_projection_nodes as parent
  cross join lateral jsonb_array_elements(case
    when jsonb_typeof(parent.source_document -> 'menuItems') = 'array'
      then parent.source_document -> 'menuItems' else '[]'::jsonb end)
    as item(value)
  where parent.entity_kind = 'menu_group'
    and nullif(item.value ->> 'guid', '') is not null;
end;
$$;

revoke all on function warehouse_projection.stage_toast_menu_nodes(jsonb)
  from public, anon, authenticated;
