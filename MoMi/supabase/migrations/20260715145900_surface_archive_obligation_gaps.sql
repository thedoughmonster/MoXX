-- service-owner: toast-data-acquisition

create view toast_acquisition.archive_obligation_status_v1
with (security_invoker = true)
as
select expected.policy_version, expected.obligation_key,
  expected.operation_key, expected.restaurant_guid, expected.mode,
  expected.coverage_dimensions, expected.window_start, expected.window_end,
  job.job_id, job.status as job_status,
  coalesce(ledger.coverage_status, 'missing_job') as coverage_status,
  ledger.attempt_count, ledger.source_response_count,
  ledger.successful_page_count, ledger.record_count,
  coalesce(ledger.raw_evidence_complete, false) as raw_evidence_complete
from toast_acquisition.expected_archive_obligations_v1 as expected
left join toast_acquisition.jobs as job
  on job.coverage_policy_version = expected.policy_version
  and job.idempotency_key = expected.obligation_key
  and job.operation_key = expected.operation_key
  and job.restaurant_guid = expected.restaurant_guid
  and job.mode = expected.mode
  and job.parameters = expected.coverage_dimensions
  and job.window_start = expected.window_start
  and job.window_end = expected.window_end
left join toast_acquisition.coverage_ledger_v1 as ledger
  on ledger.job_id = job.job_id;

create view toast_acquisition.archive_obligation_findings_v1
with (security_invoker = true)
as
select case when status.coverage_status = 'missing_job'
    then 'EXPECTED_JOB_MISSING' else 'EXPECTED_JOB_UNRESOLVED' end
    as finding_code,
  'archive_obligation'::text as record_type,
  status.obligation_key as record_key,
  status.window_start as found_at,
  jsonb_build_object('operation_key', status.operation_key,
    'restaurant_guid', status.restaurant_guid,
    'window_end', status.window_end,
    'coverage_dimensions', status.coverage_dimensions,
    'coverage_status', status.coverage_status,
    'job_id', status.job_id) as details
from toast_acquisition.archive_obligation_status_v1 as status
where status.coverage_status not in ('complete', 'empty', 'accepted_gap')
union all
select 'BACKFILL_ANCHOR_MISSING', 'restaurant',
  restaurant.restaurant_guid, policy.effective_from::timestamptz,
  jsonb_build_object('source_key', restaurant.source_key)
from toast_acquisition.historical_coverage_bounds as bound
join toast_acquisition.restaurants as restaurant
  using (source_key, restaurant_guid)
join toast_acquisition.coverage_policy_versions as policy
  using (policy_version)
where restaurant.first_business_date is null
union all
select 'COVERAGE_DIMENSION_MISSING', 'operation_coverage_policy',
  policy.policy_version || ':' || policy.operation_key,
  version.effective_from::timestamptz,
  jsonb_build_object('operation_key', policy.operation_key)
from toast_acquisition.operation_coverage_policies as policy
join toast_acquisition.coverage_policy_versions as version
  using (policy_version)
where policy.archive_class = 'historical' and not exists (
  select 1 from toast_acquisition.operation_coverage_dimensions as dimension
  where dimension.policy_version = policy.policy_version
    and dimension.operation_key = policy.operation_key
)
union all
select 'HISTORICAL_BOUND_MISSING', 'restaurant_coverage_policy',
  policy.policy_version || ':' || restaurant.source_key || ':'
    || restaurant.restaurant_guid,
  version.effective_from::timestamptz,
  jsonb_build_object('restaurant_guid', restaurant.restaurant_guid)
from toast_acquisition.operation_coverage_policies as policy
join toast_acquisition.coverage_policy_versions as version
  using (policy_version)
join toast_acquisition.restaurants as restaurant on restaurant.is_enabled
where policy.archive_class = 'historical' and not exists (
  select 1 from toast_acquisition.historical_coverage_bounds as bound
  where bound.policy_version = policy.policy_version
    and (bound.source_key, bound.restaurant_guid)
      = (restaurant.source_key, restaurant.restaurant_guid)
)
union all
select 'EXPECTED_SCHEDULE_MISSING', 'acquisition_schedule',
  policy.policy_version || ':' || policy.operation_key || ':'
    || restaurant.restaurant_guid,
  version.effective_from::timestamptz,
  jsonb_build_object('operation_key', policy.operation_key,
    'restaurant_guid', restaurant.restaurant_guid)
from toast_acquisition.operation_coverage_policies as policy
join toast_acquisition.coverage_policy_versions as version
  using (policy_version)
join toast_acquisition.restaurants as restaurant on restaurant.is_enabled
where policy.expected_schedule and not exists (
  select 1 from toast_acquisition.schedules as schedule
  where schedule.operation_key = policy.operation_key
    and schedule.restaurant_guid = restaurant.restaurant_guid
    and schedule.active
);

create view toast_acquisition.archive_acceptance_findings_v1
with (security_invoker = true)
as
select * from toast_acquisition.archive_integrity_findings_v1
union all
select * from toast_acquisition.archive_obligation_findings_v1;

revoke all on toast_acquisition.archive_obligation_status_v1,
  toast_acquisition.archive_obligation_findings_v1,
  toast_acquisition.archive_acceptance_findings_v1
  from public, anon, authenticated;

comment on view toast_acquisition.archive_acceptance_findings_v1 is
  'Combined raw-integrity and expected-obligation acceptance failures.';
