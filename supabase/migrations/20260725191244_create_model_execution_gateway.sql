-- service-owner: model-execution-gateway

create schema momi_model_execution;
revoke all on schema momi_model_execution from public, anon, authenticated;

create table momi_model_execution.profiles (
  purpose_key text not null,
  profile_key text not null,
  provider_key text not null default 'openai' check (provider_key = 'openai'),
  provider_endpoint text not null
    check (provider_endpoint = 'https://api.openai.com/v1/responses'),
  provider_model text not null check (length(provider_model) between 1 and 200),
  reasoning_effort text not null
    check (reasoning_effort in ('none', 'low', 'medium', 'high', 'xhigh', 'max')),
  maximum_input_tokens integer not null check (maximum_input_tokens between 1 and 1000000),
  maximum_output_tokens integer not null check (maximum_output_tokens between 1 and 32000),
  timeout_seconds integer not null check (timeout_seconds between 1 and 400),
  requests_per_minute integer not null check (requests_per_minute between 1 and 10000),
  requests_per_day integer not null check (requests_per_day between 1 and 1000000),
  daily_budget_micros bigint not null check (daily_budget_micros > 0),
  input_micros_per_token numeric(12,4) not null check (input_micros_per_token > 0),
  output_micros_per_token numeric(12,4) not null check (output_micros_per_token > 0),
  background_allowed boolean not null default false,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (purpose_key, profile_key),
  check (purpose_key ~ '^[a-z][a-z0-9_.-]+$'),
  check (profile_key ~ '^[a-z][a-z0-9_.-]+$')
);

create table momi_model_execution.calls (
  call_id uuid primary key default gen_random_uuid(),
  caller_key text not null check (caller_key ~ '^[a-z][a-z0-9-]+$'),
  purpose_key text not null,
  profile_key text not null,
  parent_invocation_id text not null check (length(parent_invocation_id) between 1 and 240),
  idempotency_key text not null check (length(idempotency_key) between 1 and 240),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  x_client_request_id uuid not null unique,
  background boolean not null,
  status text not null default 'admitted'
    check (status in ('admitted', 'provider_started', 'pending', 'completed',
      'failed', 'paid_ambiguous', 'cancelled', 'expired')),
  provider_response_id text,
  requested_input_tokens integer not null check (requested_input_tokens > 0),
  requested_output_tokens integer not null check (requested_output_tokens > 0),
  reserved_cost_micros bigint not null check (reserved_cost_micros >= 0),
  input_tokens integer,
  cached_input_tokens integer,
  output_tokens integer,
  reasoning_tokens integer,
  billed_cost_micros bigint,
  provider_request_id text,
  error_category text,
  deployed_function_version text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (caller_key, idempotency_key),
  foreign key (purpose_key, profile_key)
    references momi_model_execution.profiles (purpose_key, profile_key),
  check (provider_response_id is null or length(provider_response_id) between 1 and 240),
  check (provider_request_id is null or length(provider_request_id) between 1 and 240),
  check (error_category is null or length(error_category) between 1 and 120)
);

create table momi_model_execution.http_exchanges (
  exchange_id uuid primary key default gen_random_uuid(),
  call_id uuid not null references momi_model_execution.calls(call_id),
  attempt_number smallint not null check (attempt_number between 1 and 1000),
  method text not null check (method in ('POST', 'GET')),
  request_path text not null check (request_path ~ '^/v1/responses(/[A-Za-z0-9_-]+)?$'),
  x_client_request_id uuid not null,
  provider_request_id text,
  http_status integer not null check (http_status between 0 and 599),
  duration_ms integer not null check (duration_ms >= 0),
  input_tokens integer,
  cached_input_tokens integer,
  output_tokens integer,
  reasoning_tokens integer,
  billed_cost_micros bigint,
  error_category text,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  unique (call_id, attempt_number, method),
  check (provider_request_id is null or length(provider_request_id) between 1 and 240),
  check (error_category is null or length(error_category) between 1 and 120)
);

alter table momi_model_execution.profiles enable row level security;
alter table momi_model_execution.calls enable row level security;
alter table momi_model_execution.http_exchanges enable row level security;
revoke all on all tables in schema momi_model_execution from public, anon, authenticated;

insert into momi_model_execution.profiles
  (purpose_key, profile_key, provider_model, reasoning_effort,
    maximum_input_tokens, maximum_output_tokens, timeout_seconds,
    requests_per_minute, requests_per_day, daily_budget_micros,
    input_micros_per_token, output_micros_per_token,
    background_allowed, enabled)
values
  ('communications.router', 'auto', 'gpt-5.6-luna', 'low',
    8000, 500, 30, 30, 1000, 50000000, 1, 6, false, true),
  ('communications.answer', 'quick', 'gpt-5.6-luna', 'low',
    8000, 1000, 60, 30, 1000, 50000000, 1, 6, false, true),
  ('communications.answer', 'standard', 'gpt-5.6-terra', 'medium',
    8000, 4000, 60, 30, 1000, 50000000, 2.5, 15, false, true),
  ('communications.answer', 'deep', 'gpt-5.6-sol', 'high',
    8000, 8000, 120, 20, 500, 100000000, 5, 30, false, true),
  ('communications.answer', 'maximum', 'gpt-5.6-sol', 'max',
    8000, 16000, 400, 10, 200, 200000000, 5, 30, true, true),
  ('communications.evaluation', 'default', 'gpt-5.6-terra', 'medium',
    32000, 4000, 120, 10, 1000, 100000000, 2.5, 15, false, true),
  ('github.issue-triage', 'default', 'gpt-5.4-mini', 'low',
    8000, 2000, 120, 6, 500, 50000000, 1, 6, false, true);

create function momi_model_execution.admit_call_v1(
  p_caller_key text, p_purpose_key text, p_profile_key text,
  p_parent_invocation_id text, p_idempotency_key text, p_request_hash text,
  p_input_tokens integer, p_output_tokens integer, p_background boolean,
  p_deployed_function_version text
) returns table (
  disposition text, call_id uuid, status text, provider_endpoint text,
  provider_model text, reasoning_effort text, maximum_output_tokens integer,
  timeout_seconds integer, x_client_request_id uuid,
  provider_response_id text, input_micros_per_token numeric,
  output_micros_per_token numeric
) language plpgsql security definer set search_path = '' as $$
declare
  selected momi_model_execution.profiles%rowtype;
  existing momi_model_execution.calls%rowtype;
  new_call_id uuid;
  new_client_id uuid;
  recent_count integer;
  daily_count integer;
  daily_cost bigint;
  reserved bigint;
begin
  select * into selected from momi_model_execution.profiles
    where purpose_key = p_purpose_key and profile_key = p_profile_key and enabled;
  if not found or p_input_tokens <= 0 or p_input_tokens > selected.maximum_input_tokens
    or p_output_tokens <= 0 or p_output_tokens > selected.maximum_output_tokens
    or (p_background and not selected.background_allowed) then
    raise exception 'model execution profile refused request' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_purpose_key || ':' || p_profile_key, 0));
  select * into existing from momi_model_execution.calls
    where caller_key = p_caller_key and idempotency_key = p_idempotency_key;
  if found then
    if existing.request_hash <> p_request_hash
      or existing.purpose_key <> p_purpose_key
      or existing.profile_key <> p_profile_key then
      raise exception 'model execution idempotency conflict' using errcode = '23505';
    end if;
    disposition := 'duplicate'; call_id := existing.call_id;
    status := existing.status; provider_endpoint := selected.provider_endpoint;
    provider_model := selected.provider_model;
    reasoning_effort := selected.reasoning_effort;
    maximum_output_tokens := selected.maximum_output_tokens;
    timeout_seconds := selected.timeout_seconds;
    x_client_request_id := existing.x_client_request_id;
    provider_response_id := existing.provider_response_id;
    input_micros_per_token := selected.input_micros_per_token;
    output_micros_per_token := selected.output_micros_per_token;
    return next; return;
  end if;
  select count(*) into recent_count from momi_model_execution.calls
    where purpose_key = p_purpose_key and profile_key = p_profile_key
      and requested_at >= now() - interval '1 minute';
  select count(*), coalesce(sum(coalesce(billed_cost_micros, reserved_cost_micros)), 0)
    into daily_count, daily_cost from momi_model_execution.calls
    where purpose_key = p_purpose_key and profile_key = p_profile_key
      and requested_at >= date_trunc('day', now());
  reserved := ceil((p_input_tokens * selected.input_micros_per_token) +
    (p_output_tokens * selected.output_micros_per_token))::bigint;
  if recent_count >= selected.requests_per_minute
    or daily_count >= selected.requests_per_day
    or daily_cost + reserved > selected.daily_budget_micros then
    raise exception 'model execution rate or budget refused request' using errcode = '22023';
  end if;
  new_call_id := gen_random_uuid(); new_client_id := gen_random_uuid();
  insert into momi_model_execution.calls
    (call_id, caller_key, purpose_key, profile_key, parent_invocation_id,
      idempotency_key, request_hash, x_client_request_id, background,
      requested_input_tokens, requested_output_tokens, reserved_cost_micros,
      deployed_function_version)
  values (new_call_id, p_caller_key, p_purpose_key, p_profile_key,
    p_parent_invocation_id, p_idempotency_key, p_request_hash, new_client_id,
    p_background, p_input_tokens, p_output_tokens, reserved,
    p_deployed_function_version);
  disposition := 'admitted'; call_id := new_call_id; status := 'admitted';
  provider_endpoint := selected.provider_endpoint;
  provider_model := selected.provider_model;
  reasoning_effort := selected.reasoning_effort;
  maximum_output_tokens := selected.maximum_output_tokens;
  timeout_seconds := selected.timeout_seconds;
  x_client_request_id := new_client_id; provider_response_id := null;
  input_micros_per_token := selected.input_micros_per_token;
  output_micros_per_token := selected.output_micros_per_token;
  return next;
end;
$$;

create function momi_model_execution.complete_call_v1(
  p_call_id uuid, p_status text, p_provider_response_id text,
  p_provider_request_id text, p_http_status integer, p_duration_ms integer,
  p_input_tokens integer, p_cached_input_tokens integer,
  p_output_tokens integer, p_reasoning_tokens integer,
  p_billed_cost_micros bigint, p_error_category text,
  p_started_at timestamptz, p_method text, p_request_path text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  selected momi_model_execution.calls%rowtype;
  next_attempt smallint;
begin
  if p_status not in ('pending', 'completed', 'failed', 'paid_ambiguous',
    'cancelled', 'expired') or p_method not in ('POST', 'GET') then
    raise exception 'invalid model execution completion' using errcode = '22023';
  end if;
  select * into selected from momi_model_execution.calls
    where call_id = p_call_id for update;
  if not found then return false; end if;
  if p_method = 'POST' and selected.status not in ('admitted', 'provider_started') then
    return false;
  end if;
  select coalesce(max(attempt_number), 0) + 1 into next_attempt
  from momi_model_execution.http_exchanges
  where call_id = p_call_id and method = p_method;
  insert into momi_model_execution.http_exchanges
    (call_id, attempt_number, method, request_path, x_client_request_id,
      provider_request_id, http_status, duration_ms, input_tokens,
      cached_input_tokens, output_tokens, reasoning_tokens,
      billed_cost_micros, error_category, started_at, completed_at)
  values (p_call_id, next_attempt, p_method, p_request_path, selected.x_client_request_id,
    p_provider_request_id, p_http_status, p_duration_ms, p_input_tokens,
    p_cached_input_tokens, p_output_tokens, p_reasoning_tokens,
    p_billed_cost_micros, p_error_category, p_started_at, now())
  on conflict (call_id, attempt_number, method) do nothing;
  update momi_model_execution.calls set
    status = case when selected.status in ('admitted', 'provider_started', 'pending')
      then p_status else selected.status end,
    provider_response_id = p_provider_response_id,
    provider_request_id = p_provider_request_id,
    input_tokens = p_input_tokens, cached_input_tokens = p_cached_input_tokens,
    output_tokens = p_output_tokens, reasoning_tokens = p_reasoning_tokens,
    billed_cost_micros = p_billed_cost_micros,
    reserved_cost_micros = case when p_billed_cost_micros is null
      then reserved_cost_micros else 0 end,
    error_category = p_error_category,
    started_at = coalesce(started_at, p_started_at),
    completed_at = case
      when selected.status not in ('admitted', 'provider_started', 'pending')
        then completed_at
      when p_status = 'pending' then null else now() end
  where call_id = p_call_id;
  return true;
end;
$$;

create function momi_model_execution.get_call_v1(p_call_id uuid)
returns table (caller_key text, purpose_key text, profile_key text,
  status text, provider_response_id text, x_client_request_id uuid,
  provider_endpoint text, provider_model text, timeout_seconds integer,
  input_micros_per_token numeric, output_micros_per_token numeric)
language sql security definer set search_path = '' as $$
  select calls.caller_key, calls.purpose_key, calls.profile_key, calls.status,
    calls.provider_response_id, calls.x_client_request_id,
    profiles.provider_endpoint, profiles.provider_model, profiles.timeout_seconds,
    profiles.input_micros_per_token, profiles.output_micros_per_token
  from momi_model_execution.calls calls
  join momi_model_execution.profiles profiles
    on profiles.purpose_key = calls.purpose_key
    and profiles.profile_key = calls.profile_key
  where calls.call_id = p_call_id
$$;

revoke all on all functions in schema momi_model_execution
  from public, anon, authenticated;
grant execute on function momi_model_execution.admit_call_v1(
  text, text, text, text, text, text, integer, integer, boolean, text)
  to service_role;
grant execute on function momi_model_execution.complete_call_v1(
  uuid, text, text, text, integer, integer, integer, integer,
  integer, integer, bigint, text, timestamptz, text, text)
  to service_role;
grant execute on function momi_model_execution.get_call_v1(uuid)
  to service_role;
