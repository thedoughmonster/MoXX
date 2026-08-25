-- service-owner: warehouse-projection
alter table momi_warehouse.stock_observations add column snapshot_id uuid;
create index stock_observations_snapshot_idx on
  momi_warehouse.stock_observations (snapshot_id, observed_at)
  where snapshot_id is not null;
create function warehouse_projection.project_toast_stock_snapshot(
  p_job_id bigint, p_correlation_id uuid
)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  job toast_acquisition.jobs;
  attempt toast_raw.api_request_attempts;
  location_id uuid; universe_id uuid; canonical_snapshot_id uuid;
  projected_count integer;
begin
  select * into strict job from toast_acquisition.jobs
  where job_id = p_job_id;
  if job.operation_key <> 'toast.stock.snapshot.v1'
  then return 'ignored_non_stock_job'; end if;
  if job.status <> 'succeeded'
  then raise exception 'stock_job_incomplete'; end if;
  select * into attempt from toast_raw.api_request_attempts
  where job_id = p_job_id and http_status between 200 and 299
    and finished_at is not null and jsonb_typeof(response_json) = 'array'
  order by finished_at desc, attempt_id desc limit 1;
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
  from toast_raw.resource_observations as observation
  join toast_raw.resource_versions as source_version
    using (resource_version_id)
  join toast_raw.api_request_attempts as source_attempt
    on source_attempt.attempt_id = observation.attempt_id
  where source_attempt.job_id = p_job_id
    and source_attempt.http_status between 200 and 299
    and source_version.resource_type = 'stock_state';

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
        select 1 from toast_raw.resource_observations as observed
        join toast_raw.resource_versions as source using (resource_version_id)
        join toast_raw.api_request_attempts as seen_attempt
          on seen_attempt.attempt_id = observed.attempt_id
        where seen_attempt.job_id = p_job_id
          and source.resource_type = 'stock_state'
          and coalesce(source.payload ->> 'itemGuidValidity', 'VALID') = 'VALID'
          and warehouse_projection.resolve_toast_stock_item(
            job.restaurant_guid, source.payload ->> 'guid',
            source.payload ->> 'multiLocationId') = member.item_entity_id
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
  insert into momi_events.events (
    event_name, idempotency_key, entity_type, entity_id, occurred_at,
    schema_version, source_system, source_resource_type, source_id,
    source_reference, correlation_id
  ) values (
    'warehouse.stock_snapshot.observed',
    'warehouse:stock-snapshot:toast-job:' || job.job_id,
    'stock_snapshot', canonical_snapshot_id, attempt.finished_at, 1,
    'toast', 'stock_state', job.job_id::text,
    jsonb_build_object('schema', 'momi_warehouse',
      'table', 'stock_observations',
      'snapshot_id', canonical_snapshot_id,
      'observation_count', projected_count), p_correlation_id
  ) on conflict (idempotency_key) do nothing;
  return 'projected_stock_snapshot';
end;
$$;
revoke all on function warehouse_projection.project_toast_stock_snapshot(
  bigint, uuid
) from public, anon, authenticated;
