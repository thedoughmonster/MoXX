-- service-owner: communications-archive

create schema if not exists momi_communications;

create table momi_communications.source_types (
  source_type text primary key,
  capture_contract_key text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint source_types_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create table momi_communications.source_accounts (
  source_account_id uuid primary key default gen_random_uuid(),
  source_type text not null
    references momi_communications.source_types(source_type),
  source_account_key text not null,
  display_label text,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint source_accounts_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint source_accounts_identity_unique
    unique (source_type, source_account_key)
);

create table momi_communications.archive_items (
  archive_item_id uuid primary key default gen_random_uuid(),
  source_type text not null
    references momi_communications.source_types(source_type),
  source_account_id uuid not null
    references momi_communications.source_accounts(source_account_id),
  source_account_key text not null,
  source_user_key text not null,
  source_conversation_key text not null,
  source_message_key text not null,
  source_parent_message_key text,
  sender_role text not null,
  occurred_at timestamptz not null,
  captured_at timestamptz not null default now(),
  source_metadata jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  raw_text text,
  content_hash text not null,
  idempotency_key text not null,
  capture_actor text,
  tool_version text,
  model_version text,
  prompt_version text,
  created_at timestamptz not null default now(),
  constraint archive_items_metadata_object
    check (jsonb_typeof(source_metadata) = 'object'),
  constraint archive_items_payload_document
    check (jsonb_typeof(payload) in ('object', 'array')),
  constraint archive_items_content_hash_valid
    check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint archive_items_source_identity_unique unique (
    source_type, source_account_key, source_user_key,
    source_conversation_key, source_message_key
  ),
  constraint archive_items_idempotency_unique unique (
    source_type, source_account_key, source_user_key, idempotency_key
  )
);

create table momi_communications.evaluation_jobs (
  evaluation_job_id bigint generated always as identity primary key,
  archive_item_id uuid not null
    references momi_communications.archive_items(archive_item_id),
  evaluator_contract_key text not null
    default 'momi.communications.evaluate_item.v1',
  capability_token uuid not null default gen_random_uuid(),
  job_status text not null default 'pending',
  queued_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  attempt_count integer not null default 0,
  last_error_code text,
  last_error_message text,
  constraint evaluation_jobs_archive_unique unique (archive_item_id),
  constraint evaluation_jobs_capability_unique unique (capability_token),
  constraint evaluation_jobs_status_valid
    check (job_status in ('pending', 'claimed', 'completed', 'failed'))
);

create table momi_communications.communication_evaluations (
  evaluation_id bigint generated always as identity primary key,
  archive_item_id uuid not null
    references momi_communications.archive_items(archive_item_id),
  evaluation_job_id bigint
    references momi_communications.evaluation_jobs(evaluation_job_id),
  evaluator_key text not null,
  classifier_version text,
  urgency text,
  impact text,
  confidence numeric(5,4),
  decision text,
  flags jsonb not null default '[]'::jsonb,
  merge_suggestions jsonb not null default '[]'::jsonb,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint communication_evaluations_flags_array
    check (jsonb_typeof(flags) = 'array'),
  constraint communication_evaluations_output_object
    check (jsonb_typeof(output) = 'object')
);
