-- service-owner: communications-archive

create table momi_communications.derived_records (
  derived_record_id uuid primary key default gen_random_uuid(),
  archive_item_id uuid not null
    references momi_communications.archive_items(archive_item_id),
  derived_kind text not null,
  derived_key text,
  payload jsonb not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  supersedes_derived_record_id uuid
    references momi_communications.derived_records(derived_record_id),
  constraint derived_records_kind_valid
    check (derived_kind in ('task', 'knowledge', 'incident', 'alert', 'other')),
  constraint derived_records_payload_object
    check (jsonb_typeof(payload) = 'object')
);

create table momi_communications.corrections (
  correction_id bigint generated always as identity primary key,
  archive_item_id uuid
    references momi_communications.archive_items(archive_item_id),
  evaluation_id bigint
    references momi_communications.communication_evaluations(evaluation_id),
  derived_record_id uuid
    references momi_communications.derived_records(derived_record_id),
  correction_kind text not null,
  correction_payload jsonb not null,
  submitted_by text not null,
  submitted_at timestamptz not null default now(),
  constraint corrections_target_present check (
    archive_item_id is not null
    or evaluation_id is not null
    or derived_record_id is not null
  ),
  constraint corrections_payload_object
    check (jsonb_typeof(correction_payload) = 'object')
);

create table momi_communications.audit_events (
  audit_event_id bigint generated always as identity primary key,
  archive_item_id uuid
    references momi_communications.archive_items(archive_item_id),
  actor_key text not null,
  action_key text not null,
  idempotency_key text,
  source_account_id uuid
    references momi_communications.source_accounts(source_account_id),
  model_version text,
  tool_version text,
  prompt_version text,
  event_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_metadata_object
    check (jsonb_typeof(event_metadata) = 'object')
);

create function momi_communications.reject_archive_item_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Communication archive records are immutable'
    using errcode = '55000';
end;
$$;

create trigger preserve_communication_archive_items
before update or delete on momi_communications.archive_items
for each row execute function momi_communications.reject_archive_item_mutation();

create trigger preserve_communication_evaluations
before update or delete on momi_communications.communication_evaluations
for each row execute function momi_communications.reject_archive_item_mutation();

create trigger preserve_communication_derived_records
before update or delete on momi_communications.derived_records
for each row execute function momi_communications.reject_archive_item_mutation();

create trigger preserve_communication_corrections
before update or delete on momi_communications.corrections
for each row execute function momi_communications.reject_archive_item_mutation();

create trigger preserve_communication_audit_events
before update or delete on momi_communications.audit_events
for each row execute function momi_communications.reject_archive_item_mutation();
