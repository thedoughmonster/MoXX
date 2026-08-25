-- service-owner: warehouse-projection
create or replace function warehouse_projection.resolve_source_entity(
  p_entity_type text, p_source_system text,
  p_resource_type text, p_source_location_id text,
  p_source_id text, p_observed_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved_id uuid;
  resolved_type text;
  resolved_status text;
  expected_type text;
begin
  expected_type := warehouse_projection.canonical_entity_type(
    p_resource_type
  );
  if p_entity_type is distinct from expected_type then
    raise exception 'canonical_entity_type_mismatch: expected %, received %',
      expected_type, p_entity_type;
  end if;
  select link.entity_id, entity.entity_type, entity.lifecycle_status
  into resolved_id, resolved_type, resolved_status
  from momi_warehouse.source_links as link
  join momi_warehouse.entities as entity using (entity_id)
  where link.source_system = p_source_system
    and link.resource_type = p_resource_type
    and link.source_location_id = coalesce(p_source_location_id, '')
    and link.source_id = p_source_id;
  if resolved_id is null then
    begin
      insert into momi_warehouse.entities (entity_type)
      values (expected_type)
      returning entity_id, entity_type, lifecycle_status
      into resolved_id, resolved_type, resolved_status;
      insert into momi_warehouse.source_links (
        source_system, resource_type, source_location_id, source_id,
        entity_id, first_observed_at, last_observed_at
      ) values (
        p_source_system, p_resource_type,
        coalesce(p_source_location_id, ''), p_source_id,
        resolved_id, p_observed_at, p_observed_at
      );
    exception when unique_violation then
      select link.entity_id, entity.entity_type, entity.lifecycle_status
      into strict resolved_id, resolved_type, resolved_status
      from momi_warehouse.source_links as link
      join momi_warehouse.entities as entity using (entity_id)
      where link.source_system = p_source_system
        and link.resource_type = p_resource_type
        and link.source_location_id = coalesce(p_source_location_id, '')
        and link.source_id = p_source_id;
    end;
  end if;
  if resolved_type is distinct from expected_type then
    raise exception 'source_entity_type_conflict: expected %, found %',
      expected_type, resolved_type;
  end if;
  if resolved_status <> 'active' then
    raise exception 'source_entity_not_active';
  end if;
  update momi_warehouse.source_links
  set first_observed_at = least(first_observed_at, p_observed_at),
    last_observed_at = greatest(last_observed_at, p_observed_at)
  where source_system = p_source_system and resource_type = p_resource_type
    and source_location_id = coalesce(p_source_location_id, '')
    and source_id = p_source_id;
  return resolved_id;
end;
$$;
create or replace function warehouse_projection.link_source_entity(
  p_entity_id uuid,
  p_source_system text,
  p_resource_type text,
  p_source_location_id text,
  p_source_id text,
  p_observed_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare linked_id uuid; target_type text; target_status text;
begin
  select entity_type, lifecycle_status into strict target_type, target_status
  from momi_warehouse.entities where entity_id = p_entity_id;
  if target_status <> 'active' then raise exception 'source_entity_not_active'; end if;
  if target_type is distinct from
    warehouse_projection.canonical_entity_type(p_resource_type) then
    raise exception 'source_entity_type_conflict';
  end if;
  insert into momi_warehouse.source_links as existing (
    source_system, resource_type, source_location_id, source_id,
    entity_id, first_observed_at, last_observed_at
  ) values (
    p_source_system, p_resource_type, coalesce(p_source_location_id, ''),
    p_source_id, p_entity_id, p_observed_at, p_observed_at
  ) on conflict (
    source_system, resource_type, source_location_id, source_id
  ) do update set
    first_observed_at = least(existing.first_observed_at,
      excluded.first_observed_at),
    last_observed_at = greatest(existing.last_observed_at,
      excluded.last_observed_at)
  where existing.entity_id = excluded.entity_id
  returning entity_id into linked_id;
  if linked_id is null then raise exception 'source_entity_link_conflict'; end if;
  return linked_id;
end;
$$;
revoke all on function warehouse_projection.resolve_source_entity(
  text, text, text, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function warehouse_projection.link_source_entity(
  uuid, text, text, text, text, timestamptz
) from public, anon, authenticated;
