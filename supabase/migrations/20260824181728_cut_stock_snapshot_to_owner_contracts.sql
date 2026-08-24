-- service-owner: warehouse-projection

create or replace function warehouse_projection.project_toast_stock_snapshot(
  p_job_id bigint, p_correlation_id uuid
)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  job record;
  attempt record;
  location_id uuid; universe_id uuid; canonical_snapshot_id uuid;
  projected_count integer;
begin
  select * into strict job
  from toast_acquisition.read_stock_snapshot_projection_job_v1(p_job_id);
  if job.operation_key <> 'toast.stock.snapshot.v1'
  then return 'ignored_non_stock_job'; end if;
  if job.status <> 'succeeded'
  then raise exception 'stock_job_incomplete'; end if;
  select * into attempt
  from toast_raw.read_stock_snapshot_attempt_v1(p_job_id);
  if attempt.attempt_id is null
  then raise exception 'stock_archive_missing'; end if;
  select observation.snapshot_id into canonical_snapshot_id
  from momi_warehouse.stock_observations as observation
  where observation.snapshot_id is not null
    and observation.source_reference ->> 'job_id' = p_job_id::text
  limit 1;
  canonical_snapshot_id := coalesce(canonical_snapshot_id, gen_random_uuid());
  perform warehouse_projection.project_toast_stock_observation(
    observation.observation_id, observation.correlation_id
  )
  from toast_raw.read_stock_snapshot_observations_v1(p_job_id) as observation
  where observation.projection_eligible;

  if job.mode = 'snapshot' then
    location_id := warehouse_projection.resolve_source_entity(
      'location', 'toast', 'location', '', job.restaurant_guid,
      coalesce(attempt.finished_at, attempt.started_at));
    select version.universe_version_id into universe_id
    from momi_warehouse.menu_universe_versions as version
    join momi_warehouse.menu_universe_observations as observed
      using (universe_version_id)
    where version.source_system = 'toast'
      and version.source_location_id = job.restaurant_guid
      and observed.observed_at <= attempt.finished_at
    order by observed.observed_at desc, observed.observation_id desc limit 1;
    if universe_id is null
    then raise exception 'menu_universe_missing'; end if;
    insert into momi_warehouse.stock_observations (
      snapshot_id, source_observation_key, item_entity_id, location_entity_id,
      observed_at, stock_state, quantity, source_system,
      source_reference, correlation_id
    )
    select canonical_snapshot_id,
      'toast:stock-job:' || job.job_id || ':inferred:' || member.item_entity_id,
      member.item_entity_id, location_id, attempt.finished_at,
      'IN_STOCK', null, 'toast', jsonb_build_object(
        'schema', 'toast_raw', 'table', 'api_request_attempts',
        'id', attempt.attempt_id, 'job_id', job.job_id,
        'snapshot_mode', job.mode, 'observation_kind', 'inferred',
        'inference', 'absent_from_complete_exception_snapshot',
        'menu_universe_version_id', universe_id
      ), p_correlation_id
    from momi_warehouse.menu_universe_items as member
    where member.universe_version_id = universe_id
      and not exists (
        select 1
        from toast_raw.read_stock_snapshot_observations_v1(p_job_id) as observed
        where observed.item_guid_validity = 'VALID'
          and warehouse_projection.resolve_toast_stock_item(
            job.restaurant_guid, observed.item_guid,
            observed.multi_location_id) = member.item_entity_id
      )
    on conflict (source_observation_key) do nothing;
  end if;

  update momi_warehouse.stock_observations
  set snapshot_id = canonical_snapshot_id
  where snapshot_id is null
    and source_reference ->> 'job_id' = p_job_id::text;
  select count(*) into projected_count
  from momi_warehouse.stock_observations
  where snapshot_id = canonical_snapshot_id;
  if projected_count = 0
  then return 'ignored_unmapped_stock_snapshot'; end if;
  perform momi_events.append_warehouse_event_v1(
    'warehouse.stock_snapshot.observed', 1,
    'warehouse:stock-snapshot:toast-job:' || job.job_id,
    'stock_snapshot', canonical_snapshot_id, attempt.finished_at,
    'toast', 'stock_state', job.job_id::text,
    jsonb_build_object(
      'schema', 'momi_warehouse', 'table', 'stock_observations',
      'snapshot_id', canonical_snapshot_id,
      'observation_count', projected_count
    ), p_correlation_id
  );
  return 'projected_stock_snapshot';
end;
$$;
