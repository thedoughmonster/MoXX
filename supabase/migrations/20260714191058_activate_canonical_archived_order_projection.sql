-- service-owner: warehouse-projection

create or replace function warehouse_projection.project_toast_archived_order(
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
begin
  select * into strict observation from toast_raw.resource_observations
  where observation_id = p_observation_id;
  select * into strict source_version from toast_raw.resource_versions
  where resource_version_id = observation.resource_version_id;
  if source_version.resource_type <> 'order' then
    raise exception 'Observation % is not an order', p_observation_id;
  end if;
  return warehouse_projection.project_toast_order(
    'archive:' || source_version.resource_version_id,
    'toast:resource-observation:' || observation.observation_id,
    p_correlation_id
  );
end;
$$;

revoke all on function warehouse_projection.project_toast_archived_order(
  bigint, uuid
) from public, anon, authenticated;
