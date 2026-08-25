create role anon nologin;
create role authenticated nologin;
create schema extensions;
create extension pgcrypto with schema extensions;
create schema toast_acquisition;
create schema toast_raw;

create table toast_acquisition.expected_archive_obligations_v1 (
  policy_version text not null,
  obligation_key text not null,
  operation_key text not null,
  restaurant_guid uuid not null,
  mode text not null,
  coverage_dimensions jsonb not null,
  window_start timestamptz not null,
  window_end timestamptz not null
);

create table toast_acquisition.jobs (
  job_id bigint primary key,
  coverage_policy_version text not null,
  idempotency_key text not null,
  operation_key text not null,
  restaurant_guid uuid not null,
  mode text not null,
  parameters jsonb not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  status text not null
);

create table toast_acquisition.coverage_ledger_v1 (
  job_id bigint primary key,
  coverage_status text not null,
  attempt_count integer not null,
  source_response_count integer not null,
  successful_page_count integer not null,
  record_count integer not null,
  raw_evidence_complete boolean not null
);

create table toast_acquisition.operations (
  operation_key text primary key,
  resource_type text not null
);

create table toast_raw.api_request_attempts (
  attempt_id uuid primary key,
  job_id bigint not null,
  operation_key text not null,
  restaurant_guid text not null,
  http_status integer,
  response_body text,
  response_json jsonb,
  response_sha256 text,
  error_code text,
  correlation_id uuid not null
);

create table toast_raw.resource_versions (
  resource_version_id uuid primary key,
  source_system text not null,
  resource_type text not null,
  restaurant_guid text not null,
  source_id text not null,
  retrieved_at timestamptz not null,
  content_hash text not null,
  payload jsonb not null,
  first_attempt_id uuid not null
);

create table toast_raw.resource_observations (
  observation_id bigint primary key,
  resource_version_id uuid not null,
  attempt_id uuid not null,
  observed_at timestamptz not null,
  correlation_id uuid not null
);

create table toast_acquisition.test_integrity_findings (
  finding_code text not null,
  record_type text not null,
  record_key text not null,
  found_at timestamptz not null,
  details jsonb not null
);

create view toast_acquisition.archive_integrity_findings_v1
with (security_invoker = true) as
select * from toast_acquisition.test_integrity_findings;

insert into toast_acquisition.expected_archive_obligations_v1
select 'toast-archive-v1', operation_key || ':7b84bb81-3660-4215-a571-39cbad9611d2:2026-07-01',
  operation_key, '7b84bb81-3660-4215-a571-39cbad9611d2', 'date_range',
  jsonb_build_object('business_date', '2026-07-01'),
  '2026-07-01T04:00:00Z', '2026-07-16T04:00:00Z'
from unnest(array[
  'toast.labor.shifts.v1', 'toast.labor.time_entries.v1', 'toast.orders.bulk.v1'
]) with ordinality as operation(operation_key, position);

insert into toast_acquisition.expected_archive_obligations_v1 values
  ('toast-archive-v1', 'near-miss-window', 'toast.orders.bulk.v1',
   '7b84bb81-3660-4215-a571-39cbad9611d2', 'date_range',
   '{"business_date":"2026-07-01"}', '2026-07-01T04:00:00Z',
   '2026-07-16T04:00:00Z'),
  ('toast-archive-v1', 'unrelated-containing-window', 'toast.orders.bulk.v1',
   '7b84bb81-3660-4215-a571-39cbad9611d2', 'date_range',
   '{"business_date":"2026-07-01"}', '2026-07-01T04:00:00Z',
   '2026-07-16T04:00:00Z');

insert into toast_acquisition.jobs
select 80 + position, 'toast-archive-v1',
  operation_key || ':7b84bb81-3660-4215-a571-39cbad9611d2:2026-07-01',
  operation_key, '7b84bb81-3660-4215-a571-39cbad9611d2', 'date_range',
  jsonb_build_object('business_date', '2026-07-01'),
  '2026-07-01T04:00:00Z', '2026-07-17T04:00:00Z', 'succeeded'
from unnest(array[
  'toast.orders.bulk.v1', 'toast.labor.shifts.v1', 'toast.labor.time_entries.v1'
]) with ordinality as operation(operation_key, position);

insert into toast_acquisition.jobs values
  (84, 'toast-archive-v1', 'near-miss-window', 'toast.orders.bulk.v1',
   '7b84bb81-3660-4215-a571-39cbad9611d2', 'date_range',
   '{"business_date":"2026-07-01"}', '2026-07-01T04:00:00Z',
   '2026-07-16T03:59:59.999Z', 'succeeded'),
  (85, 'toast-archive-v1', 'unrelated-containing-window',
   'toast.orders.bulk.v1', '7b84bb81-3660-4215-a571-39cbad9611d2',
   'date_range', '{"business_date":"2026-07-01"}',
   '2026-07-01T04:00:00Z', '2026-07-17T04:00:00Z', 'succeeded');

insert into toast_acquisition.coverage_ledger_v1
select job_id, 'complete', 1, 1, 1, 1, true
from toast_acquisition.jobs;

insert into toast_acquisition.operations values
  ('toast.payments.list.v1', 'payment');

insert into toast_raw.api_request_attempts values
  ('9e429363-3852-4de7-b52f-32b4001d1bc5', 2802,
   'toast.payments.list.v1', '7b84bb81-3660-4215-a571-39cbad9611d2', 200,
   $response$["4213591a-15ff-4495-9c04-da26de8992af","760689d4-5582-4dfc-a9d2-be04a3826e4b","4c4aa6af-b3f1-4a75-9b4a-9b402e90a820","56682b64-5584-4c66-866a-b2dda9aa1446","5c007b41-0c72-4191-9a90-2fae32714fc2","14f1b38d-a0fe-47b9-b747-6e71f1bc6943","f3e60884-4091-425f-a201-545020ecb75b","70d1ae8d-3696-497b-bb31-882a49001fb7","08b2ac4e-2388-4dcc-b972-5109adb34597","8fdcf3cc-1f00-48b0-992e-76b5ae66ba90","a061f924-b94d-47fc-b99f-854fa820e117","291f7fce-0dda-47ed-a1ab-9d7a96cfaa4b","082c6337-f3c2-4445-86d0-79f0c15b1331","c0b5d27c-e580-4872-a47d-15c5bc126376","85af0af2-bab9-406f-877c-42c260a70ea9","d1ba6b0f-e071-4d9f-bdb0-3a5569e1589e","d7187dcf-3dd0-4070-b614-7d65fb061c78","8e05f575-641f-47d5-b241-1d1acae8940f","410b4629-695f-4035-9db8-f65067073da4","2ff53d11-d67b-411e-af92-5f1c1017870c","6b0af8d5-aeb4-4be3-8ffc-2d06a26d7193","fece40a2-b686-48e2-a51c-5c5d9238cc8d","fdcf7e40-9696-48ec-8ffe-ea395eeaa68d","03f4e52f-ec4b-4882-a64d-80c1d49e1841","583d32c1-8799-47e9-9365-694f93cafa69","a353f7ef-a3ee-4b9d-817d-98f15b5d4708","14337875-e21a-4c6c-a843-83ccd9abe1d5","7f9fdf4d-c345-4b85-8d33-56dacf98a63c","046c84ef-03af-4c32-8c30-a305aed159e5","d27f81e4-312d-47fc-bed8-8e589c43b20d"]$response$,
   $response$["4213591a-15ff-4495-9c04-da26de8992af","760689d4-5582-4dfc-a9d2-be04a3826e4b","4c4aa6af-b3f1-4a75-9b4a-9b402e90a820","56682b64-5584-4c66-866a-b2dda9aa1446","5c007b41-0c72-4191-9a90-2fae32714fc2","14f1b38d-a0fe-47b9-b747-6e71f1bc6943","f3e60884-4091-425f-a201-545020ecb75b","70d1ae8d-3696-497b-bb31-882a49001fb7","08b2ac4e-2388-4dcc-b972-5109adb34597","8fdcf3cc-1f00-48b0-992e-76b5ae66ba90","a061f924-b94d-47fc-b99f-854fa820e117","291f7fce-0dda-47ed-a1ab-9d7a96cfaa4b","082c6337-f3c2-4445-86d0-79f0c15b1331","c0b5d27c-e580-4872-a47d-15c5bc126376","85af0af2-bab9-406f-877c-42c260a70ea9","d1ba6b0f-e071-4d9f-bdb0-3a5569e1589e","d7187dcf-3dd0-4070-b614-7d65fb061c78","8e05f575-641f-47d5-b241-1d1acae8940f","410b4629-695f-4035-9db8-f65067073da4","2ff53d11-d67b-411e-af92-5f1c1017870c","6b0af8d5-aeb4-4be3-8ffc-2d06a26d7193","fece40a2-b686-48e2-a51c-5c5d9238cc8d","fdcf7e40-9696-48ec-8ffe-ea395eeaa68d","03f4e52f-ec4b-4882-a64d-80c1d49e1841","583d32c1-8799-47e9-9365-694f93cafa69","a353f7ef-a3ee-4b9d-817d-98f15b5d4708","14337875-e21a-4c6c-a843-83ccd9abe1d5","7f9fdf4d-c345-4b85-8d33-56dacf98a63c","046c84ef-03af-4c32-8c30-a305aed159e5","d27f81e4-312d-47fc-bed8-8e589c43b20d"]$response$::jsonb,
   'baa7596ff7f265f37be748cd66eb5adb789d168e9596584774fffea939024613',
   null, '97c09a54-4581-4f2b-ac33-7713cd3372de'),
  ('e4458421-11bc-4dae-8260-6e87552d8f11', 2804,
   'toast.payments.list.v1', '7b84bb81-3660-4215-a571-39cbad9611d2', 200,
   '["5c007b41-0c72-4191-9a90-2fae32714fc2"]',
   '["5c007b41-0c72-4191-9a90-2fae32714fc2"]',
   '86a6a66d1843a478661c846276fe53688ba49052f33b7988bff8855f78d67b88',
   null, '4b89e294-6381-420b-a72d-7258b7d71781');

insert into toast_raw.resource_versions values
  ('ea19fa11-229d-4b89-9967-c40403c91447', 'toast', 'payment',
   '7b84bb81-3660-4215-a571-39cbad9611d2',
   '5c007b41-0c72-4191-9a90-2fae32714fc2', '2026-07-16T15:19:06.747Z',
   'da60b88f14879a5364dddc4ee5ce7a30b68753b32e8841f2e5e1740b5dad974d',
   '{"value":"5c007b41-0c72-4191-9a90-2fae32714fc2"}',
   'e4458421-11bc-4dae-8260-6e87552d8f11');

insert into toast_raw.resource_observations values
  (42982, 'ea19fa11-229d-4b89-9967-c40403c91447',
   'e4458421-11bc-4dae-8260-6e87552d8f11', '2026-07-16T15:19:06.747Z',
   '4b89e294-6381-420b-a72d-7258b7d71781'),
  (42986, 'ea19fa11-229d-4b89-9967-c40403c91447',
   '9e429363-3852-4de7-b52f-32b4001d1bc5', '2026-07-16T15:19:06.668Z',
   '97c09a54-4581-4f2b-ac33-7713cd3372de'),
  (42987, 'ea19fa11-229d-4b89-9967-c40403c91447',
   '9e429363-3852-4de7-b52f-32b4001d1bc5', '2026-07-16T15:20:00Z',
   '97c09a54-4581-4f2b-ac33-7713cd3372de');

insert into toast_acquisition.test_integrity_findings values
  ('RAW_OBSERVATION_MISMATCH', 'resource_observation', '42982',
   '2026-07-16T15:19:06.747Z', jsonb_build_object('attempt_id',
   'e4458421-11bc-4dae-8260-6e87552d8f11'::uuid, 'resource_version_id',
   'ea19fa11-229d-4b89-9967-c40403c91447'::uuid)),
  ('RAW_OBSERVATION_MISMATCH', 'resource_observation', '42986',
   '2026-07-16T15:19:06.668Z', jsonb_build_object('attempt_id',
   '9e429363-3852-4de7-b52f-32b4001d1bc5'::uuid, 'resource_version_id',
   'ea19fa11-229d-4b89-9967-c40403c91447'::uuid)),
  ('RAW_OBSERVATION_MISMATCH', 'resource_observation', '42987',
   '2026-07-16T15:20:00Z', jsonb_build_object('attempt_id',
   '00000000-0000-0000-0000-000000000001'::uuid, 'resource_version_id',
   '00000000-0000-0000-0000-000000000002'::uuid));

create view toast_acquisition.archive_obligation_status_v1
with (security_invoker = true) as
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
  and job.mode = expected.mode and job.parameters = expected.coverage_dimensions
  and job.window_start = expected.window_start and job.window_end = expected.window_end
left join toast_acquisition.coverage_ledger_v1 as ledger using (job_id);

create view toast_acquisition.archive_obligation_findings_v1
with (security_invoker = true) as
select case when coverage_status = 'missing_job' then 'EXPECTED_JOB_MISSING'
    else 'EXPECTED_JOB_UNRESOLVED' end as finding_code,
  'archive_obligation'::text as record_type, obligation_key as record_key,
  window_start as found_at, jsonb_build_object('job_id', job_id) as details
from toast_acquisition.archive_obligation_status_v1
where coverage_status not in ('complete', 'empty', 'accepted_gap');

create view toast_acquisition.archive_acceptance_findings_v1
with (security_invoker = true) as
select * from toast_acquisition.archive_integrity_findings_v1
union all select * from toast_acquisition.archive_obligation_findings_v1;
