-- service-owner: warehouse-projection

create function warehouse_projection.link_source_entity(
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
declare linked_id uuid;
begin
  insert into momi_warehouse.source_links (
    source_system, resource_type, source_location_id, source_id,
    entity_id, first_observed_at, last_observed_at
  ) values (
    p_source_system, p_resource_type, coalesce(p_source_location_id, ''),
    p_source_id, p_entity_id, p_observed_at, p_observed_at
  ) on conflict (
    source_system, resource_type, source_location_id, source_id
  ) do update set
    first_observed_at = least(
      momi_warehouse.source_links.first_observed_at,
      excluded.first_observed_at
    ),
    last_observed_at = greatest(
      momi_warehouse.source_links.last_observed_at,
      excluded.last_observed_at
    )
  where momi_warehouse.source_links.entity_id = excluded.entity_id
  returning entity_id into linked_id;
  if linked_id is null then
    raise exception 'source_entity_link_conflict';
  end if;
  return linked_id;
end;
$$;

revoke all on function warehouse_projection.link_source_entity(
  uuid, text, text, text, text, timestamptz
) from public, anon, authenticated;
