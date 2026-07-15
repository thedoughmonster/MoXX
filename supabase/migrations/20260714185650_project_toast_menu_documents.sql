-- service-owner: warehouse-projection

create function warehouse_projection.project_toast_menu_document(
  p_observation_id bigint,
  p_correlation_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  observation toast_raw.resource_observations;
  source_version toast_raw.resource_versions;
  attempt toast_raw.api_request_attempts;
  location_id uuid;
begin
  select * into strict observation
  from toast_raw.resource_observations
  where observation_id = p_observation_id;
  select * into strict source_version
  from toast_raw.resource_versions
  where resource_version_id = observation.resource_version_id;
  select * into strict attempt from toast_raw.api_request_attempts
  where attempt_id = observation.attempt_id;
  if source_version.resource_type <> 'menu'
    or attempt.operation_key <> 'toast.menus.full.v1' then
    raise exception 'Observation % is not a full menu', p_observation_id;
  end if;
  if jsonb_typeof(source_version.payload) <> 'object'
    or jsonb_typeof(source_version.payload -> 'menus') <> 'array' then
    raise exception 'Full menu document is invalid';
  end if;
  if nullif(source_version.payload ->> 'restaurantGuid', '') is not null
    and source_version.payload ->> 'restaurantGuid'
      <> source_version.restaurant_guid then
    raise exception 'Full menu restaurant does not match archive';
  end if;
  location_id := warehouse_projection.resolve_source_entity(
    'location', 'toast', 'location', '', source_version.restaurant_guid,
    observation.observed_at
  );
  perform warehouse_projection.stage_toast_menu_nodes(source_version.payload);
  perform warehouse_projection.stage_toast_menu_references(
    source_version.payload, source_version.restaurant_guid,
    observation.observed_at
  );
  perform warehouse_projection.build_toast_menu_edges();
  perform warehouse_projection.project_staged_menu_entities(
    observation.observation_id, p_correlation_id, location_id,
    source_version.restaurant_guid, source_version.source_version_id,
    source_version.content_hash, observation.observed_at
  );
  return 'projected_menu_universe';
end;
$$;

revoke all on function warehouse_projection.project_toast_menu_document(
  bigint, uuid
) from public, anon, authenticated;
