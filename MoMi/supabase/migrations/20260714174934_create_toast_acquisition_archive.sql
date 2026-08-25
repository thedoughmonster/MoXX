-- service-owner: toast-data-acquisition

create function toast_raw.has_header(p_headers jsonb, p_header text)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_headers) as header(name)
    where pg_catalog.lower(header.name) = pg_catalog.lower(p_header)
  );
$$;

create table toast_raw.api_request_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  job_id bigint not null,
  operation_key text not null,
  restaurant_guid text not null,
  request_url text not null,
  request_headers jsonb not null,
  request_cursor jsonb not null default '{}'::jsonb,
  started_at timestamptz not null,
  finished_at timestamptz,
  http_status integer,
  response_headers jsonb not null default '{}'::jsonb,
  response_body text,
  response_json jsonb,
  response_sha256 text,
  error_code text,
  error_message text,
  correlation_id uuid not null,
  constraint api_attempt_request_headers_object
    check (jsonb_typeof(request_headers) = 'object'),
  constraint api_attempt_no_authorization check (
    not toast_raw.has_header(request_headers, 'authorization')
  ),
  constraint api_attempt_response_headers_object
    check (jsonb_typeof(response_headers) = 'object'),
  constraint api_attempt_cursor_object
    check (jsonb_typeof(request_cursor) = 'object'),
  constraint api_attempt_hash_valid
    check (response_sha256 is null or response_sha256 ~ '^[0-9a-f]{64}$')
);

create table toast_raw.resource_versions (
  resource_version_id uuid primary key default gen_random_uuid(),
  source_system text not null default 'toast',
  resource_type text not null,
  restaurant_guid text not null,
  source_id text not null,
  source_version_id text not null,
  source_updated_at timestamptz,
  retrieved_at timestamptz not null,
  content_hash text not null,
  payload jsonb not null,
  first_attempt_id uuid not null
    references toast_raw.api_request_attempts(attempt_id),
  constraint resource_versions_payload_valid
    check (jsonb_typeof(payload) in ('object', 'array')),
  constraint resource_versions_hash_valid
    check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint resource_versions_immutable_unique unique (
    source_system, resource_type, restaurant_guid, source_id, content_hash
  )
);

create table toast_raw.resource_observations (
  observation_id bigint generated always as identity primary key,
  resource_version_id uuid not null
    references toast_raw.resource_versions(resource_version_id),
  attempt_id uuid not null references toast_raw.api_request_attempts(attempt_id),
  observed_at timestamptz not null,
  page_cursor jsonb not null default '{}'::jsonb,
  correlation_id uuid not null,
  constraint resource_observations_cursor_object
    check (jsonb_typeof(page_cursor) = 'object')
);

create index api_request_attempts_job_idx
  on toast_raw.api_request_attempts (job_id, started_at);
create index resource_versions_lookup_idx on toast_raw.resource_versions (
  resource_type, restaurant_guid, source_id, retrieved_at desc
);
create index resource_observations_version_idx
  on toast_raw.resource_observations (resource_version_id, observed_at desc);

alter table toast_raw.api_request_attempts enable row level security;
alter table toast_raw.resource_versions enable row level security;
alter table toast_raw.resource_observations enable row level security;
revoke all on all tables in schema toast_raw
  from public, anon, authenticated;
revoke all on all sequences in schema toast_raw
  from public, anon, authenticated;
revoke all on function toast_raw.has_header(jsonb, text)
  from public, anon, authenticated;
