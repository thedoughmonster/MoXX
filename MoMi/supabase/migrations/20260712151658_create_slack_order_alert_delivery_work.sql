create table toast_alerting.slack_delivery_work (
  id bigint generated always as identity primary key,
  candidate_id bigint not null unique
    references toast_alerting.order_alert_candidates(id),
  trigger_token uuid not null default gen_random_uuid() unique,
  idempotency_key uuid not null default gen_random_uuid() unique,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  not_before timestamptz not null default now(),
  started_at timestamptz,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  last_error text,
  last_outcome jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint slack_delivery_work_status_valid
    check (status in ('pending', 'running', 'succeeded', 'failed')),
  constraint slack_delivery_work_attempt_count_valid
    check (attempt_count >= 0),
  constraint slack_delivery_work_outcome_object
    check (jsonb_typeof(last_outcome) = 'object')
);

create index slack_delivery_work_claim_idx
  on toast_alerting.slack_delivery_work (
    status,
    not_before,
    lease_expires_at,
    created_at
  );

create table toast_alerting.slack_delivery_attempts (
  id bigint generated always as identity primary key,
  work_id bigint not null
    references toast_alerting.slack_delivery_work(id),
  invocation_id uuid not null default gen_random_uuid() unique,
  code_commit_sha text not null,
  deployment_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null default 'running',
  http_status integer,
  slack_channel_id text,
  slack_message_ts text,
  response_metadata jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  constraint slack_delivery_attempt_commit_present
    check (nullif(code_commit_sha, '') is not null),
  constraint slack_delivery_attempt_outcome_valid
    check (outcome in ('running', 'succeeded', 'failed')),
  constraint slack_delivery_attempt_response_object
    check (jsonb_typeof(response_metadata) = 'object')
);

create index slack_delivery_attempts_work_idx
  on toast_alerting.slack_delivery_attempts (work_id);

alter table toast_alerting.slack_delivery_work enable row level security;
alter table toast_alerting.slack_delivery_attempts enable row level security;

revoke all on table toast_alerting.slack_delivery_work
  from public, anon, authenticated;
revoke all on table toast_alerting.slack_delivery_attempts
  from public, anon, authenticated;
revoke all on sequence toast_alerting.slack_delivery_work_id_seq
  from public, anon, authenticated;
revoke all on sequence toast_alerting.slack_delivery_attempts_id_seq
  from public, anon, authenticated;
