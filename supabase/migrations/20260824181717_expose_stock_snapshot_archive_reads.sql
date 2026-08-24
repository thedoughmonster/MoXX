-- service-owner: communications-archive

create function toast_raw.read_stock_snapshot_attempt_v1(
  p_job_id bigint
)
returns table (
  attempt_id uuid,
  started_at timestamptz,
  finished_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select attempt.attempt_id, attempt.started_at, attempt.finished_at
  from toast_raw.api_request_attempts as attempt
  where attempt.job_id = p_job_id
    and attempt.http_status between 200 and 299
    and attempt.finished_at is not null
    and pg_catalog.jsonb_typeof(attempt.response_json) = 'array'
  order by attempt.finished_at desc, attempt.attempt_id desc
  limit 1;
$$;

create function toast_raw.read_stock_snapshot_observations_v1(
  p_job_id bigint
)
returns table (
  observation_id bigint,
  correlation_id uuid,
  projection_eligible boolean,
  item_guid_validity text,
  item_guid text,
  multi_location_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    observation.observation_id,
    observation.correlation_id,
    coalesce(attempt.http_status between 200 and 299, false),
    coalesce(source.payload ->> 'itemGuidValidity', 'VALID'),
    source.payload ->> 'guid',
    source.payload ->> 'multiLocationId'
  from toast_raw.resource_observations as observation
  join toast_raw.resource_versions as source using (resource_version_id)
  join toast_raw.api_request_attempts as attempt
    on attempt.attempt_id = observation.attempt_id
  where attempt.job_id = p_job_id
    and source.resource_type = 'stock_state'
  order by observation.observation_id;
$$;

comment on function toast_raw.read_stock_snapshot_attempt_v1(bigint) is
  'Latest successful finished array attempt timing for one stock snapshot job.';
comment on function toast_raw.read_stock_snapshot_observations_v1(bigint) is
  'Complete stock observation identities and projection eligibility for one job.';

revoke all on function toast_raw.read_stock_snapshot_attempt_v1(bigint)
  from public, anon, authenticated, service_role;
revoke all on function toast_raw.read_stock_snapshot_observations_v1(bigint)
  from public, anon, authenticated, service_role;
grant execute on function toast_raw.read_stock_snapshot_attempt_v1(bigint)
  to svc_warehouse_projection;
grant execute on function toast_raw.read_stock_snapshot_observations_v1(bigint)
  to svc_warehouse_projection;
