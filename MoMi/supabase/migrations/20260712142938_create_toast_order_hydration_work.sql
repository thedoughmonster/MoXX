create table toast_hydration.order_hydration_jobs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source_key text not null,
  function_key text not null
    references toast_hydration.function_registry(function_key),
  restaurant_guid text not null,
  order_guid text not null,
  requested_source_version text not null,
  downstream_api_contract_key text not null,
  raw_event_id bigint references toast_raw.order_webhook_events(id),
  correlation_id uuid not null default gen_random_uuid(),
  status text not null default 'pending',
  not_before timestamptz not null default now(),
  attempt_count integer not null default 0,
  started_at timestamptz,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  last_error text,
  constraint order_hydration_jobs_restaurant_fk
    foreign key (source_key, restaurant_guid)
    references toast_hydration.restaurants(source_key, restaurant_guid),
  constraint order_hydration_jobs_order_guid_present
    check (nullif(order_guid, '') is not null),
  constraint order_hydration_jobs_version_present
    check (nullif(requested_source_version, '') is not null),
  constraint order_hydration_jobs_api_contract_present
    check (nullif(downstream_api_contract_key, '') is not null),
  constraint order_hydration_jobs_status_valid
    check (status in ('pending', 'running', 'succeeded', 'failed')),
  constraint order_hydration_jobs_attempt_count_valid
    check (attempt_count >= 0),
  constraint order_hydration_jobs_idempotency_unique
    unique (
      source_key,
      restaurant_guid,
      order_guid,
      requested_source_version
    )
);

create index order_hydration_jobs_claim_idx
  on toast_hydration.order_hydration_jobs (
    status,
    not_before,
    lease_expires_at,
    created_at
  );
create index order_hydration_jobs_raw_event_id_idx
  on toast_hydration.order_hydration_jobs (raw_event_id);

create table toast_hydration.order_hydration_attempts (
  id bigint generated always as identity primary key,
  job_id bigint not null
    references toast_hydration.order_hydration_jobs(id),
  invocation_id uuid not null default gen_random_uuid(),
  code_commit_sha text not null,
  deployment_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null default 'running',
  http_status integer,
  response_headers jsonb not null default '{}'::jsonb,
  source_error_body jsonb,
  resolved_input jsonb not null,
  order_version_id bigint references toast_raw.orders(id),
  error_code text,
  error_message text,
  constraint order_hydration_attempt_invocation_unique
    unique (invocation_id),
  constraint order_hydration_attempt_commit_present
    check (nullif(code_commit_sha, '') is not null),
  constraint order_hydration_attempt_outcome_valid
    check (outcome in ('running', 'succeeded', 'failed', 'invalid_response')),
  constraint order_hydration_attempt_headers_object
    check (jsonb_typeof(response_headers) = 'object'),
  constraint order_hydration_attempt_input_object
    check (jsonb_typeof(resolved_input) = 'object')
);

create index order_hydration_attempts_job_id_idx
  on toast_hydration.order_hydration_attempts (job_id);
create index order_hydration_attempts_order_version_idx
  on toast_hydration.order_hydration_attempts (order_version_id);

alter table toast_hydration.order_hydration_jobs enable row level security;
alter table toast_hydration.order_hydration_attempts enable row level security;

revoke all on all tables in schema toast_hydration
  from public, anon, authenticated;
revoke all on all sequences in schema toast_hydration
  from public, anon, authenticated;

alter default privileges in schema toast_hydration
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema toast_hydration
  revoke all on sequences from public, anon, authenticated;
