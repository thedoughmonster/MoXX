-- service-owner: warehouse-projection
do $$
declare archived record;
begin
  for archived in
    select observation.observation_id, observation.correlation_id
    from toast_raw.resource_observations as observation
    join toast_raw.resource_versions as version using (resource_version_id)
    where version.resource_type = 'ordering_schedule'
    order by observation.observation_id
  loop
    perform warehouse_projection.project_toast_resource_observation(
      archived.observation_id, archived.correlation_id);
  end loop;

  if exists (
    select 1 from toast_raw.resource_observations as observation
    join toast_raw.resource_versions as source using (resource_version_id)
    left join momi_warehouse.version_observations as projected on
      projected.source_observation_key = 'toast:resource-observation:'
        || observation.observation_id || ':ordering-schedule-v1'
    left join momi_warehouse.entity_versions as version
      on version.entity_version_id = projected.entity_version_id
    where source.resource_type = 'ordering_schedule' and (
      version.entity_version_id is null
      or version.canonical_document ->> 'schedule_kind' <> 'online_ordering'
      or jsonb_typeof(version.canonical_document -> 'weekly_periods') <> 'array'
      or jsonb_typeof(version.canonical_document -> 'date_exceptions') <> 'array'
      or version.canonical_document ?| array[
        'servicePeriods', 'overrides', 'timeZoneId',
        'diningOptionBehavior', 'lastOrderConfiguration']
    )
  ) then raise exception 'Canonical ordering schedule replay is incomplete';
  end if;
end;
$$;
