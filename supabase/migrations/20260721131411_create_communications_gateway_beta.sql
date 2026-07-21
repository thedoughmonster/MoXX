-- service-owner: communications-gateway

create schema momi_communications_gateway;

create table momi_communications_gateway.gateway_state (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  cohort_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table momi_communications_gateway.provider_bindings (
  alias text primary key,
  provider_key text not null,
  endpoint text not null,
  model text not null,
  enabled boolean not null default false,
  maximum_attempt_cost_micros bigint not null default 0
    check (maximum_attempt_cost_micros >= 0),
  updated_at timestamptz not null default now(),
  constraint provider_alias_exact check (alias = 'momi-assistant'),
  constraint provider_endpoint_exact
    check (endpoint = 'https://api.openai.com/v1/chat/completions')
);

create table momi_communications_gateway.access_entries (
  user_id uuid primary key,
  email text not null unique check (email = lower(email) and email like '%@%'),
  active boolean not null default false,
  is_admin boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  constraint normal_user_not_admin check (not active or not is_admin)
);

create table momi_communications_gateway.user_limits (
  user_id uuid primary key references momi_communications_gateway.access_entries(user_id),
  requests_per_minute integer not null check (requests_per_minute between 1 and 60),
  maximum_input_tokens integer not null check (maximum_input_tokens between 1 and 200000),
  maximum_output_tokens integer not null check (maximum_output_tokens between 1 and 32000),
  timeout_seconds integer not null check (timeout_seconds between 5 and 120),
  budget_micros bigint not null check (budget_micros >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid not null
);

create table momi_communications_gateway.invocations (
  invocation_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references momi_communications_gateway.access_entries(user_id),
  conversation_id text not null,
  turn_id text not null,
  idempotency_key text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  alias text not null,
  provider_key text not null,
  provider_model text not null,
  status text not null default 'pending_archive',
  archive_admission_receipt uuid,
  terminal_archive_receipt uuid,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  billed_micros bigint not null default 0,
  started_at timestamptz not null default now(),
  archive_admitted_at timestamptz,
  provider_started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  constraint invocation_identity_unique unique (user_id, idempotency_key),
  constraint invocation_status_valid check (status in (
    'pending_archive', 'admitted', 'provider_started', 'completed',
    'failed', 'paid_ambiguous'
  )),
  constraint invocation_receipt_required check (
    status <> 'completed' or terminal_archive_receipt is not null
  )
);

create index invocations_user_started_idx
  on momi_communications_gateway.invocations (user_id, started_at desc);

create table momi_communications_gateway.audit_events (
  audit_event_id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  target_user_id uuid,
  action_key text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

insert into momi_communications_gateway.gateway_state default values;
insert into momi_communications_gateway.provider_bindings
  (alias, provider_key, endpoint, model, enabled)
values ('momi-assistant', 'unconfigured',
  'https://api.openai.com/v1/chat/completions', 'unconfigured', false);

create function momi_communications_gateway.admit_invocation_v1(
  p_user_id uuid, p_email text, p_conversation_id text, p_turn_id text,
  p_alias text, p_idempotency_key text, p_request_hash text,
  p_input_tokens integer
)
returns table (
  disposition text, invocation_id uuid, provider_key text, provider_model text,
  provider_endpoint text, maximum_output_tokens integer,
  timeout_seconds integer, maximum_attempt_cost_micros bigint
)
language plpgsql security definer set search_path = ''
as $$
declare
  existing momi_communications_gateway.invocations%rowtype;
  binding momi_communications_gateway.provider_bindings%rowtype;
  limits momi_communications_gateway.user_limits%rowtype;
  new_id uuid;
  recent_count integer;
  spend bigint;
begin
  if not exists (select 1 from momi_communications_gateway.gateway_state
    where singleton and enabled and cohort_enabled) then
    raise exception 'communications gateway is disabled' using errcode = '55000';
  end if;
  if p_alias <> 'momi-assistant' or p_email <> lower(p_email) then
    raise exception 'invalid beta identity or alias' using errcode = '22023';
  end if;
  if not exists (select 1 from momi_communications_gateway.access_entries
    where user_id = p_user_id and email = p_email and active and not is_admin) then
    raise exception 'user is not in the active beta cohort' using errcode = '42501';
  end if;
  select * into binding from momi_communications_gateway.provider_bindings
    where alias = p_alias and enabled;
  if not found then raise exception 'provider binding is disabled' using errcode = '55000'; end if;
  select * into limits from momi_communications_gateway.user_limits
    where user_id = p_user_id for update;
  if not found or p_input_tokens > limits.maximum_input_tokens then
    raise exception 'effective user limit refused request' using errcode = '22023';
  end if;
  select * into existing from momi_communications_gateway.invocations
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if existing.request_hash <> p_request_hash then
      raise exception 'idempotency key conflicts with request' using errcode = '23505';
    end if;
    disposition := 'duplicate'; invocation_id := existing.invocation_id;
    provider_key := existing.provider_key; provider_model := existing.provider_model;
    provider_endpoint := binding.endpoint;
    maximum_output_tokens := limits.maximum_output_tokens;
    timeout_seconds := limits.timeout_seconds;
    maximum_attempt_cost_micros := binding.maximum_attempt_cost_micros;
    return next; return;
  end if;
  select count(*) into recent_count from momi_communications_gateway.invocations
    where user_id = p_user_id and started_at >= now() - interval '1 minute';
  select coalesce(sum(billed_micros), 0) into spend
    from momi_communications_gateway.invocations where user_id = p_user_id;
  if recent_count >= limits.requests_per_minute
    or spend + binding.maximum_attempt_cost_micros > limits.budget_micros then
    raise exception 'effective rate or budget limit refused request' using errcode = '22023';
  end if;
  insert into momi_communications_gateway.invocations (
    user_id, conversation_id, turn_id, idempotency_key, request_hash, alias,
    provider_key, provider_model, input_tokens
  ) values (p_user_id, p_conversation_id, p_turn_id, p_idempotency_key,
    p_request_hash, p_alias, binding.provider_key, binding.model, p_input_tokens)
  returning momi_communications_gateway.invocations.invocation_id into new_id;
  disposition := 'admitted'; invocation_id := new_id;
  provider_key := binding.provider_key; provider_model := binding.model;
  provider_endpoint := binding.endpoint;
  maximum_output_tokens := limits.maximum_output_tokens;
  timeout_seconds := limits.timeout_seconds;
  maximum_attempt_cost_micros := binding.maximum_attempt_cost_micros;
  return next;
end;
$$;

create function momi_communications_gateway.mark_archive_admitted_v1(
  p_invocation_id uuid, p_archive_receipt uuid
) returns boolean language sql security definer set search_path = '' as $$
  update momi_communications_gateway.invocations
  set status = 'admitted', archive_admission_receipt = p_archive_receipt,
      archive_admitted_at = now()
  where invocation_id = p_invocation_id and status = 'pending_archive'
    and p_archive_receipt is not null returning true
$$;

create function momi_communications_gateway.mark_provider_started_v1(
  p_invocation_id uuid
) returns boolean language sql security definer set search_path = '' as $$
  update momi_communications_gateway.invocations
  set status = 'provider_started', provider_started_at = now()
  where invocation_id = p_invocation_id and status = 'admitted'
    and archive_admission_receipt is not null returning true
$$;

create function momi_communications_gateway.complete_invocation_v1(
  p_invocation_id uuid, p_status text, p_terminal_receipt uuid,
  p_output_tokens integer, p_billed_micros bigint, p_error_code text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('completed', 'failed', 'paid_ambiguous')
    or (p_status = 'completed' and p_terminal_receipt is null) then
    raise exception 'invalid terminal invocation state' using errcode = '22023';
  end if;
  update momi_communications_gateway.invocations set status = p_status,
    terminal_archive_receipt = p_terminal_receipt,
    output_tokens = greatest(coalesce(p_output_tokens, 0), 0),
    billed_micros = greatest(coalesce(p_billed_micros, 0), 0),
    error_code = p_error_code, completed_at = now()
  where invocation_id = p_invocation_id and status = 'provider_started';
  return found;
end;
$$;

create function momi_communications_gateway.get_conversation_execution_v1(
  p_user_id uuid, p_conversation_id text
) returns table (invocation_id uuid, turn_id text, status text,
  provider_key text, provider_model text, input_tokens integer,
  output_tokens integer, started_at timestamptz, completed_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select i.invocation_id, i.turn_id, i.status, i.provider_key,
    i.provider_model, i.input_tokens, i.output_tokens, i.started_at, i.completed_at
  from momi_communications_gateway.invocations i
  where i.user_id = p_user_id and i.conversation_id = p_conversation_id
  order by i.started_at, i.invocation_id
$$;

create function momi_communications_gateway.list_models_v1()
returns table (model_alias text)
language sql security definer set search_path = '' stable as $$
  select binding.alias
  from momi_communications_gateway.provider_bindings binding
  cross join momi_communications_gateway.gateway_state state
  where state.singleton and state.enabled and state.cohort_enabled
    and binding.enabled and binding.alias = 'momi-assistant'
$$;

create function momi_communications_gateway.set_user_access_v1(
  p_actor uuid, p_admin_authorized boolean, p_user_id uuid, p_email text,
  p_active boolean
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not p_admin_authorized or p_email <> lower(p_email) then
    raise exception 'Zac administration required' using errcode = '42501';
  end if;
  insert into momi_communications_gateway.access_entries
    (user_id, email, active, is_admin, updated_by)
  values (p_user_id, p_email, p_active, false, p_actor)
  on conflict (user_id) do update set email = excluded.email,
    active = excluded.active, is_admin = false, updated_at = now(),
    updated_by = excluded.updated_by;
  insert into momi_communications_gateway.audit_events
    (actor_user_id, target_user_id, action_key, details)
  values (p_actor, p_user_id, 'set_user_access_v1', jsonb_build_object('active', p_active));
  return true;
end;
$$;

create function momi_communications_gateway.set_user_limits_v1(
  p_actor uuid, p_admin_authorized boolean, p_user_id uuid,
  p_requests_per_minute integer, p_maximum_input_tokens integer,
  p_maximum_output_tokens integer, p_timeout_seconds integer, p_budget_micros bigint
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not p_admin_authorized then raise exception 'Zac administration required' using errcode = '42501'; end if;
  insert into momi_communications_gateway.user_limits values (
    p_user_id, p_requests_per_minute, p_maximum_input_tokens,
    p_maximum_output_tokens, p_timeout_seconds, p_budget_micros, now(), p_actor)
  on conflict (user_id) do update set
    requests_per_minute = excluded.requests_per_minute,
    maximum_input_tokens = excluded.maximum_input_tokens,
    maximum_output_tokens = excluded.maximum_output_tokens,
    timeout_seconds = excluded.timeout_seconds, budget_micros = excluded.budget_micros,
    updated_at = now(), updated_by = excluded.updated_by;
  insert into momi_communications_gateway.audit_events
    (actor_user_id, target_user_id, action_key, details)
  values (p_actor, p_user_id, 'set_user_limits_v1', jsonb_build_object(
    'requests_per_minute', p_requests_per_minute,
    'maximum_input_tokens', p_maximum_input_tokens,
    'maximum_output_tokens', p_maximum_output_tokens,
    'timeout_seconds', p_timeout_seconds, 'budget_micros', p_budget_micros));
  return true;
end;
$$;

create function momi_communications_gateway.set_gateway_state_v1(
  p_actor uuid, p_admin_authorized boolean, p_enabled boolean,
  p_cohort_enabled boolean, p_provider_key text, p_provider_model text,
  p_maximum_attempt_cost_micros bigint
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not p_admin_authorized or p_provider_key = '' or p_provider_model = '' then
    raise exception 'Zac administration and exact provider binding required' using errcode = '42501';
  end if;
  update momi_communications_gateway.provider_bindings set
    provider_key = p_provider_key, model = p_provider_model,
    maximum_attempt_cost_micros = p_maximum_attempt_cost_micros,
    enabled = p_enabled, updated_at = now() where alias = 'momi-assistant';
  if p_enabled and not exists (select 1 from momi_communications_gateway.access_entries a
    join momi_communications_gateway.user_limits l using (user_id) where a.active) then
    raise exception 'cannot activate without exact access and limits' using errcode = '55000';
  end if;
  update momi_communications_gateway.gateway_state set enabled = p_enabled,
    cohort_enabled = p_cohort_enabled, updated_at = now(), updated_by = p_actor
  where singleton;
  insert into momi_communications_gateway.audit_events
    (actor_user_id, action_key, details) values
    (p_actor, 'set_gateway_state_v1', jsonb_build_object(
      'enabled', p_enabled, 'cohort_enabled', p_cohort_enabled,
      'provider_key', p_provider_key, 'provider_model', p_provider_model,
      'maximum_attempt_cost_micros', p_maximum_attempt_cost_micros));
  return true;
end;
$$;

alter table momi_communications_gateway.gateway_state enable row level security;
alter table momi_communications_gateway.provider_bindings enable row level security;
alter table momi_communications_gateway.access_entries enable row level security;
alter table momi_communications_gateway.user_limits enable row level security;
alter table momi_communications_gateway.invocations enable row level security;
alter table momi_communications_gateway.audit_events enable row level security;
revoke all on schema momi_communications_gateway from public, anon, authenticated;
revoke all on all tables in schema momi_communications_gateway from public, anon, authenticated;
revoke all on all sequences in schema momi_communications_gateway from public, anon, authenticated;
revoke all on all functions in schema momi_communications_gateway from public, anon, authenticated;
grant usage on schema momi_communications_gateway to service_role;
grant execute on all functions in schema momi_communications_gateway to service_role;
