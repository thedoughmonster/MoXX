-- service-owner: toast-data-acquisition
create view toast_acquisition.coverage_ledger_v1
with (security_invoker = true)
as
with attempt_rollup as (
  select attempt.job_id,
    count(*) as attempt_count,
    count(*) filter (where attempt.http_status is not null)
      as source_response_count,
    count(*) filter (where attempt.http_status between 200 and 299
      and attempt.error_code is null) as successful_page_count,
    count(*) filter (where attempt.http_status = 204)
      as no_content_page_count,
    count(*) filter (where attempt.finished_at is null or (
      attempt.http_status is not null and (
        attempt.response_body is null or attempt.response_sha256 is null
      )
    )) as invalid_evidence_count,
    min(attempt.started_at) as first_attempt_at,
    max(attempt.finished_at) as last_attempt_at
  from toast_raw.api_request_attempts as attempt
  join toast_acquisition.jobs as job using (job_id)
  where attempt.pagination_generation = job.pagination_generation
  group by attempt.job_id
), observation_rollup as (
  select attempt.job_id, count(observation.observation_id) as record_count
  from toast_raw.api_request_attempts as attempt
  join toast_acquisition.jobs as job using (job_id)
  join toast_raw.resource_observations as observation using (attempt_id)
  where attempt.pagination_generation = job.pagination_generation
  group by attempt.job_id
), latest_evidence as (
  select distinct on (coverage.job_id)
    coverage.job_id, coverage.coverage_id,
    coverage.coverage_status, coverage.checked_at,
    coverage.terminal_attempt_id
  from toast_acquisition.coverage_windows as coverage
  where coverage.job_id is not null
  order by coverage.job_id, coverage.checked_at desc, coverage.coverage_id desc
)
select job.coverage_policy_version as policy_version,
  job.idempotency_key as obligation_key,
  job.job_id, job.operation_key, operation.source_operation_id,
  operation.resource_type, policy.archive_class,
  case when job.mode = 'backfill' then 'historical_window'
    when job.mode = 'repair' then 'exact_resource_repair'
    else 'scheduled_or_reconciled' end as obligation_kind,
  job.restaurant_guid, job.mode, job.parameters as coverage_dimensions,
  job.parameters ->> 'date_selector' as date_selector,
  job.parameters ->> 'guid' as repair_source_id,
  job.window_start, job.window_end, job.pagination_generation,
  job.status as job_status,
  case
    when coalesce(attempts.attempt_count, 0) = 0 then 'missing_attempt'
    when job.status in ('pending', 'running') then 'in_progress'
    when job.status = 'dead_letter' then 'dead_letter'
    when job.status = 'retry_wait'
      and coalesce(attempts.successful_page_count, 0) > 0 then 'partial'
    when job.status = 'retry_wait' then 'gap'
    when coalesce(attempts.successful_page_count, 0) = 0 then 'gap'
    when coalesce(attempts.no_content_page_count, 0)
      > 0 and policy.accepted_no_content_status = 204 then 'accepted_gap'
    when coalesce(observations.record_count, 0) = 0
      and policy.empty_response_allowed then 'empty'
    when coalesce(observations.record_count, 0) = 0 then 'gap'
    else 'complete'
  end as coverage_status,
  evidence.coverage_status as recorded_coverage_status,
  evidence.coverage_id, evidence.terminal_attempt_id,
  coalesce(attempts.attempt_count, 0) as attempt_count,
  coalesce(attempts.source_response_count, 0) as source_response_count,
  coalesce(attempts.successful_page_count, 0) as successful_page_count,
  coalesce(observations.record_count, 0) as record_count,
  coalesce(attempts.invalid_evidence_count, 0) = 0
    and coalesce(attempts.attempt_count, 0) > 0 as raw_evidence_complete,
  attempts.first_attempt_at, attempts.last_attempt_at,
  evidence.checked_at as coverage_checked_at,
  job.created_at, job.completed_at, job.last_error
from toast_acquisition.jobs as job
join toast_acquisition.operations as operation using (operation_key)
join toast_acquisition.operation_coverage_policies as policy
  on policy.policy_version = job.coverage_policy_version
  and policy.operation_key = job.operation_key
left join attempt_rollup as attempts using (job_id)
left join observation_rollup as observations using (job_id)
left join latest_evidence as evidence using (job_id);

create view toast_acquisition.operation_coverage_v1
with (security_invoker = true)
as
select policy.policy_version, operation.operation_key,
  operation.source_operation_id, operation.resource_type,
  policy.archive_class, policy.historical_window_kind,
  policy.expected_schedule,
  (select count(*) from toast_acquisition.schedules as schedule
    where schedule.operation_key = operation.operation_key
      and schedule.active) as active_schedule_count,
  count(ledger.job_id) as obligation_count,
  count(*) filter (where ledger.coverage_status in (
    'missing_attempt', 'in_progress', 'partial', 'gap', 'dead_letter'
  )) as unresolved_obligation_count,
  coalesce(sum(ledger.source_response_count), 0) as source_response_count,
  min(ledger.first_attempt_at) as first_attempt_at,
  max(ledger.last_attempt_at) as last_attempt_at
from toast_acquisition.operation_coverage_policies as policy
join toast_acquisition.operations as operation using (operation_key)
left join toast_acquisition.coverage_ledger_v1 as ledger
  on ledger.policy_version = policy.policy_version
  and ledger.operation_key = policy.operation_key
group by policy.policy_version, operation.operation_key,
  operation.source_operation_id, operation.resource_type,
  policy.archive_class, policy.historical_window_kind,
  policy.expected_schedule;

revoke all on toast_acquisition.coverage_ledger_v1
  from public, anon, authenticated;
revoke all on toast_acquisition.operation_coverage_v1
  from public, anon, authenticated;
