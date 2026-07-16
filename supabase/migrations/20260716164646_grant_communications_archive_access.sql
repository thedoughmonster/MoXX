-- service-owner: communications-archive

insert into momi_communications.source_types (
  source_type, capture_contract_key, description
) values (
  'openai',
  'momi.communications.capture_openai_message.v1',
  'OpenAI and ChatGPT conversations captured through the first archive contract.'
) on conflict (source_type) do update
set capture_contract_key = excluded.capture_contract_key,
  description = excluded.description,
  active = true;

create index archive_items_account_time_idx
  on momi_communications.archive_items (
    source_type, source_account_key, occurred_at desc
  );

create index archive_items_conversation_idx
  on momi_communications.archive_items (
    source_type, source_account_key, source_conversation_key, occurred_at
  );

create index archive_items_source_account_idx
  on momi_communications.archive_items (source_account_id);

create index evaluation_jobs_claim_idx
  on momi_communications.evaluation_jobs (job_status, queued_at)
  where job_status in ('pending', 'failed');

create index communication_evaluations_item_idx
  on momi_communications.communication_evaluations (
    archive_item_id, created_at desc
  );

create index communication_evaluations_job_idx
  on momi_communications.communication_evaluations (evaluation_job_id)
  where evaluation_job_id is not null;

create index derived_records_item_idx
  on momi_communications.derived_records (archive_item_id, created_at desc);

create index derived_records_supersedes_idx
  on momi_communications.derived_records (supersedes_derived_record_id)
  where supersedes_derived_record_id is not null;

create index corrections_archive_item_idx
  on momi_communications.corrections (archive_item_id, submitted_at desc);

create index corrections_evaluation_idx
  on momi_communications.corrections (evaluation_id)
  where evaluation_id is not null;

create index corrections_derived_idx
  on momi_communications.corrections (derived_record_id)
  where derived_record_id is not null;

create index audit_events_archive_item_idx
  on momi_communications.audit_events (archive_item_id)
  where archive_item_id is not null;

create index audit_events_source_account_idx
  on momi_communications.audit_events (source_account_id)
  where source_account_id is not null;

alter table momi_communications.source_types enable row level security;
alter table momi_communications.source_accounts enable row level security;
alter table momi_communications.archive_items enable row level security;
alter table momi_communications.evaluation_jobs enable row level security;
alter table momi_communications.communication_evaluations enable row level security;
alter table momi_communications.derived_records enable row level security;
alter table momi_communications.corrections enable row level security;
alter table momi_communications.audit_events enable row level security;

revoke all on schema momi_communications from public, anon, authenticated;
revoke all on all tables in schema momi_communications
  from public, anon, authenticated;
revoke all on all sequences in schema momi_communications
  from public, anon, authenticated;
revoke all on all functions in schema momi_communications
  from public, anon, authenticated;

grant usage on schema momi_communications to service_role;
grant select, insert on all tables in schema momi_communications to service_role;
grant update on momi_communications.evaluation_jobs to service_role;
grant usage, select on all sequences in schema momi_communications
  to service_role;
grant execute on function momi_communications.capture_openai_message_v1(
  text, text, text, text, text, timestamptz, jsonb, text, timestamptz, jsonb,
  text, text, text, text, text, text
) to service_role;

comment on schema momi_communications is
  'Private immutable communications archive and evaluator staging records.';

comment on table momi_communications.archive_items is
  'Immutable source communications with channel-neutral source identity.';

comment on table momi_communications.evaluation_jobs is
  'Durable immediate evaluator work created by each new archive item.';
