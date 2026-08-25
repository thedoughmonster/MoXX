-- service-owner: toast-data-acquisition
-- Forward rollback: restore the two prior view definitions in a new owner
-- migration. Preserve this immutable evidence table; no raw or job mutation
-- is required.

create table toast_acquisition.archive_finding_reconciliations (
  finding_code text not null,
  record_type text not null,
  record_key text not null,
  finding_found_at timestamptz not null,
  finding_details jsonb not null check (jsonb_typeof(finding_details) = 'object'),
  disposition text not null check (disposition = 'evidence_valid'),
  decision_id uuid not null,
  decision_content_digest text not null
    check (decision_content_digest ~ '^[0-9a-f]{64}$'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  reconciled_at timestamptz not null default clock_timestamp(),
  primary key (finding_code, record_type, record_key),
  constraint archive_reconciliation_identity_present check (
    nullif(finding_code, '') is not null
    and nullif(record_type, '') is not null
    and nullif(record_key, '') is not null
  )
);

create function toast_acquisition.reject_archive_reconciliation_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Archive finding reconciliations are immutable'
    using errcode = '55000';
end;
$$;

create trigger preserve_archive_finding_reconciliations
before update or delete on toast_acquisition.archive_finding_reconciliations
for each row execute function
  toast_acquisition.reject_archive_reconciliation_mutation();

create trigger preserve_archive_finding_reconciliations_truncate
before truncate on toast_acquisition.archive_finding_reconciliations
for each statement execute function
  toast_acquisition.reject_archive_reconciliation_mutation();

do $$
declare
  target_count integer;
begin
  select count(*) into target_count
  from toast_acquisition.archive_acceptance_findings_v1
  where (finding_code = 'EXPECTED_JOB_MISSING' and record_key = any (array[
    'toast.labor.shifts.v1:7b84bb81-3660-4215-a571-39cbad9611d2:2026-07-01',
    'toast.labor.time_entries.v1:7b84bb81-3660-4215-a571-39cbad9611d2:2026-07-01',
    'toast.orders.bulk.v1:7b84bb81-3660-4215-a571-39cbad9611d2:2026-07-01'
  ])) or (finding_code = 'RAW_OBSERVATION_MISMATCH'
    and record_type = 'resource_observation' and record_key = '42986');
  if target_count = 0 then return; end if;
  if target_count <> 4 then
    raise exception 'Toast archive reconciliation target set drifted';
  end if;
  if not exists (
    select 1
    from toast_acquisition.archive_integrity_findings_v1 as finding
    where finding.finding_code = 'RAW_OBSERVATION_MISMATCH'
      and finding.record_type = 'resource_observation'
      and finding.record_key = '42986'
      and finding.found_at = '2026-07-16T15:19:06.668Z'
      and finding.details = jsonb_build_object(
        'attempt_id', '9e429363-3852-4de7-b52f-32b4001d1bc5'::uuid,
        'resource_version_id', 'ea19fa11-229d-4b89-9967-c40403c91447'::uuid)
  ) then raise exception 'Toast archive reconciliation finding evidence drifted';
  end if;
  insert into toast_acquisition.archive_finding_reconciliations (
    finding_code, record_type, record_key, finding_found_at, finding_details,
    disposition, decision_id, decision_content_digest, evidence
  ) values (
    'RAW_OBSERVATION_MISMATCH', 'resource_observation', '42986',
    '2026-07-16T15:19:06.668Z', jsonb_build_object(
      'attempt_id', '9e429363-3852-4de7-b52f-32b4001d1bc5'::uuid,
      'resource_version_id', 'ea19fa11-229d-4b89-9967-c40403c91447'::uuid),
    'evidence_valid', '15fc8df1-d248-4b8a-8ff4-f148804d1280',
    '34092f42098b84e0e9cfdc2421d31e6d746cf831c5d4039b5eebd66ae02e64fb',
    jsonb_build_object('rule', 'concurrent_dedup_shared_version',
      'first_attempt_id', 'e4458421-11bc-4dae-8260-6e87552d8f11',
      'source_id', '5c007b41-0c72-4191-9a90-2fae32714fc2',
      'content_hash', 'da60b88f14879a5364dddc4ee5ce7a30b68753b32e8841f2e5e1740b5dad974d',
      'response_sha256', 'baa7596ff7f265f37be748cd66eb5adb789d168e9596584774fffea939024613',
      'first_response_sha256', '86a6a66d1843a478661c846276fe53688ba49052f33b7988bff8855f78d67b88')
  );
end;
$$;

create or replace view toast_acquisition.archive_obligation_status_v1
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
  and case when expected.obligation_key = any (array[
    'toast.labor.shifts.v1:7b84bb81-3660-4215-a571-39cbad9611d2:2026-07-01',
    'toast.labor.time_entries.v1:7b84bb81-3660-4215-a571-39cbad9611d2:2026-07-01',
    'toast.orders.bulk.v1:7b84bb81-3660-4215-a571-39cbad9611d2:2026-07-01'
  ]) then job.window_start <= expected.window_start
    and job.window_end >= expected.window_end
  else job.window_start = expected.window_start
    and job.window_end = expected.window_end end
left join toast_acquisition.coverage_ledger_v1 as ledger
  on ledger.job_id = job.job_id;

create or replace view toast_acquisition.archive_acceptance_findings_v1
with (security_invoker = true)
as
select finding.*
from (
  select * from toast_acquisition.archive_integrity_findings_v1
  union all
  select * from toast_acquisition.archive_obligation_findings_v1
) as finding
where not exists (
  select 1
  from toast_acquisition.archive_finding_reconciliations as reconciliation
  where reconciliation.finding_code = finding.finding_code
    and reconciliation.record_type = finding.record_type
    and reconciliation.record_key = finding.record_key
    and reconciliation.finding_found_at = finding.found_at
    and reconciliation.finding_details = finding.details
    and reconciliation.disposition = 'evidence_valid'
);

alter table toast_acquisition.archive_finding_reconciliations
  enable row level security;
revoke all on toast_acquisition.archive_finding_reconciliations
  from public, anon, authenticated;
revoke all on function
  toast_acquisition.reject_archive_reconciliation_mutation()
  from public, anon, authenticated;

comment on table toast_acquisition.archive_finding_reconciliations is
  'Immutable exact-finding dispositions backed by preserved archive evidence.';
comment on view toast_acquisition.archive_obligation_status_v1 is
  'Expected obligations linked to exact-key jobs whose windows fully cover them.';
comment on view toast_acquisition.archive_acceptance_findings_v1 is
  'Unreconciled raw-integrity and expected-obligation acceptance failures.';
