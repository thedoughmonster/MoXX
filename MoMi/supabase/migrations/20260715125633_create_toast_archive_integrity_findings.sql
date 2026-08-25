-- service-owner: toast-data-acquisition

create view toast_acquisition.archive_integrity_findings_v1
with (security_invoker = true)
as
select 'RAW_JOB_MISMATCH'::text as finding_code,
  'api_request_attempt'::text as record_type,
  attempt.attempt_id::text as record_key,
  attempt.started_at as found_at,
  jsonb_build_object('job_id', attempt.job_id) as details
from toast_raw.api_request_attempts as attempt
left join toast_acquisition.jobs as job using (job_id)
where job.job_id is null or (
  attempt.operation_key,
  attempt.restaurant_guid,
  attempt.correlation_id
) is distinct from (
  job.operation_key,
  job.restaurant_guid,
  job.correlation_id
)
union all
select 'RAW_RESPONSE_INVALID', 'api_request_attempt',
  attempt.attempt_id::text, attempt.started_at,
  jsonb_build_object('job_id', attempt.job_id,
    'http_status', attempt.http_status)
from toast_raw.api_request_attempts as attempt
where attempt.http_status is not null and (
  attempt.finished_at is null or attempt.response_body is null
  or attempt.response_sha256 is null
  or attempt.response_sha256 <> encode(extensions.digest(
    convert_to(attempt.response_body, 'UTF8'), 'sha256'), 'hex')
)
union all
select 'RAW_ATTEMPT_STALE_OPEN', 'api_request_attempt',
  attempt.attempt_id::text, attempt.started_at,
  jsonb_build_object('job_id', attempt.job_id)
from toast_raw.api_request_attempts as attempt
left join toast_acquisition.jobs as job using (job_id)
where attempt.finished_at is null and not coalesce(
  job.status = 'running' and job.lease_expires_at > now(), false
)
union all
select 'RAW_OBSERVATION_MISMATCH', 'resource_observation',
  observation.observation_id::text, observation.observed_at,
  jsonb_build_object('attempt_id', attempt.attempt_id,
    'resource_version_id', version.resource_version_id)
from toast_raw.resource_observations as observation
join toast_raw.resource_versions as version using (resource_version_id)
join toast_raw.api_request_attempts as attempt using (attempt_id)
join toast_acquisition.operations as operation
  on operation.operation_key = attempt.operation_key
where attempt.http_status not between 200 and 299
  or attempt.error_code is not null
  or version.restaurant_guid <> attempt.restaurant_guid
  or version.resource_type <> operation.resource_type
  or observation.correlation_id <> attempt.correlation_id
  or version.retrieved_at > observation.observed_at
union all
select 'RAW_PROCESSING_FAILURE', 'raw_processing_failure',
  failure.failure_id::text, failure.failed_at,
  jsonb_build_object('source_table', failure.source_table,
    'source_record_id', failure.source_record_id,
    'processing_stage', failure.processing_stage)
from toast_acquisition.raw_processing_failures as failure
union all
select 'ACQUISITION_DEAD_LETTER', 'acquisition_job',
  job.job_id::text, coalesce(job.completed_at, job.created_at),
  jsonb_build_object('operation_key', job.operation_key,
    'last_error', job.last_error)
from toast_acquisition.jobs as job
where job.status = 'dead_letter';

revoke all on toast_acquisition.archive_integrity_findings_v1
  from public, anon, authenticated;

comment on view toast_acquisition.archive_integrity_findings_v1 is
  'Read-only archive acceptance failures; an empty result is required.';
