-- service-owner: warehouse-projection

create function warehouse_projection.resolve_toast_stock_item(
  p_restaurant_guid text,
  p_item_guid text,
  p_multi_location_id text
)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select link.entity_id
  from momi_warehouse.source_links as link
  join momi_warehouse.entities as entity using (entity_id)
  where link.source_system = 'toast'
    and link.source_location_id = p_restaurant_guid
    and entity.entity_type = 'menu_item'
    and (
      (link.resource_type = 'menu_item' and link.source_id = p_item_guid)
      or (link.resource_type = 'menu_item_multilocation'
        and link.source_id = p_multi_location_id)
    )
  order by case link.resource_type when 'menu_item' then 0 else 1 end,
    link.last_observed_at desc
  limit 1;
$$;

create function warehouse_projection.project_toast_stock_observation(
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
  job toast_acquisition.jobs;
  item_id uuid;
  location_id uuid;
  canonical_state text;
begin
  select * into strict observation from toast_raw.resource_observations
  where observation_id = p_observation_id;
  select * into strict source_version from toast_raw.resource_versions
  where resource_version_id = observation.resource_version_id;
  select * into strict attempt from toast_raw.api_request_attempts
  where attempt_id = observation.attempt_id;
  select * into strict job from toast_acquisition.jobs
  where job_id = attempt.job_id;
  if source_version.resource_type <> 'stock_state' then
    raise exception 'Observation % is not stock', p_observation_id;
  end if;
  if coalesce(source_version.payload ->> 'itemGuidValidity', 'VALID')
    <> 'VALID' then return 'ignored_invalid_stock_item'; end if;
  item_id := warehouse_projection.resolve_toast_stock_item(
    source_version.restaurant_guid, source_version.payload ->> 'guid',
    source_version.payload ->> 'multiLocationId'
  );
  if item_id is null then return 'ignored_unmapped_stock_item'; end if;
  location_id := warehouse_projection.resolve_source_entity(
    'location', 'toast', 'location', '', source_version.restaurant_guid,
    observation.observed_at
  );
  canonical_state := case source_version.payload ->> 'status'
    when 'IN_STOCK' then 'IN_STOCK'
    when 'QUANTITY' then 'LOW_QUANTITY'
    when 'OUT_OF_STOCK' then 'OUT_OF_STOCK'
    else 'UNKNOWN' end;
  insert into momi_warehouse.stock_observations (
    source_observation_key, item_entity_id, location_entity_id,
    observed_at, stock_state, quantity, source_system,
    source_reference, correlation_id
  ) values (
    'toast:resource-observation:' || observation.observation_id,
    item_id, location_id, observation.observed_at, canonical_state,
    case when jsonb_typeof(source_version.payload -> 'quantity') = 'number'
      then (source_version.payload ->> 'quantity')::numeric else null end,
    'toast', jsonb_build_object(
      'schema', 'toast_raw', 'table', 'resource_observations',
      'id', observation.observation_id, 'attempt_id', attempt.attempt_id,
      'job_id', job.job_id, 'snapshot_mode', job.mode,
      'observation_kind', 'explicit',
      'reported_state', source_version.payload ->> 'status'
    ), p_correlation_id
  ) on conflict (source_observation_key) do nothing;
  return 'projected_stock_observation';
end;
$$;

revoke all on function warehouse_projection.resolve_toast_stock_item(
  text, text, text
) from public, anon, authenticated;
revoke all on function warehouse_projection.project_toast_stock_observation(
  bigint, uuid
) from public, anon, authenticated;
