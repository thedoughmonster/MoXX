-- service-owner: warehouse-projection

create function warehouse_projection.stage_toast_menu_references(
  p_payload jsonb,
  p_restaurant_guid text,
  p_observed_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into pg_temp.menu_projection_nodes (
    entity_kind, source_guid, source_multi_location_id,
    source_reference_id, source_role, source_document
  )
  select 'modifier_group', entry.value ->> 'guid',
    nullif(entry.value ->> 'multiLocationId', ''), entry.key,
    'modifier_group', entry.value
  from jsonb_each(case
    when jsonb_typeof(p_payload -> 'modifierGroupReferences') = 'object'
      then p_payload -> 'modifierGroupReferences' else '{}'::jsonb end)
    as entry(key, value)
  where nullif(entry.value ->> 'guid', '') is not null;

  insert into pg_temp.menu_projection_nodes (
    entity_kind, source_guid, source_multi_location_id,
    source_reference_id, source_role, source_document
  )
  select 'modifier_option', entry.value ->> 'guid',
    nullif(entry.value ->> 'multiLocationId', ''), entry.key,
    'modifier_option', entry.value
  from jsonb_each(case
    when jsonb_typeof(p_payload -> 'modifierOptionReferences') = 'object'
      then p_payload -> 'modifierOptionReferences' else '{}'::jsonb end)
    as entry(key, value)
  where nullif(entry.value ->> 'guid', '') is not null;

  insert into pg_temp.menu_projection_nodes (
    entity_kind, source_guid, source_multi_location_id,
    source_role, source_document
  )
  select 'menu_item', entry.value ->> 'guid',
    nullif(entry.value ->> 'multiLocationId', ''),
    'modifier_item_reference', entry.value
  from jsonb_each(case
    when jsonb_typeof(p_payload -> 'modifierOptionReferences') = 'object'
      then p_payload -> 'modifierOptionReferences' else '{}'::jsonb end)
    as entry(key, value)
  where nullif(entry.value ->> 'guid', '') is not null;

  update pg_temp.menu_projection_nodes
  set entity_id = warehouse_projection.resolve_source_entity(
    warehouse_projection.canonical_entity_type(entity_kind),
    'toast', entity_kind, p_restaurant_guid,
    source_guid, p_observed_at
  );

  perform warehouse_projection.link_source_entity(
    node.entity_id, 'toast', node.entity_kind || '_multilocation',
    p_restaurant_guid, node.source_multi_location_id, p_observed_at
  )
  from (
    select distinct entity_id, entity_kind, source_multi_location_id
    from pg_temp.menu_projection_nodes
    where source_multi_location_id is not null
  ) as node;

  perform warehouse_projection.link_source_entity(
    node.entity_id, 'toast', node.entity_kind || '_reference',
    p_restaurant_guid, node.source_reference_id, p_observed_at
  )
  from (
    select distinct entity_id, entity_kind, source_reference_id
    from pg_temp.menu_projection_nodes
    where source_reference_id is not null
  ) as node;
end;
$$;

revoke all on function warehouse_projection.stage_toast_menu_references(
  jsonb, text, timestamptz
) from public, anon, authenticated;
