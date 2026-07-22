-- service-owner: communications-gateway

create table momi_communications_gateway.routing_policy (
  singleton boolean primary key default true check (singleton),
  router_endpoint text not null
    check (router_endpoint = 'https://api.openai.com/v1/responses'),
  answer_endpoint text not null
    check (answer_endpoint = 'https://api.openai.com/v1/responses'),
  router_model text not null check (length(router_model) between 1 and 200),
  router_reasoning_effort text not null check (router_reasoning_effort in ('none', 'low', 'medium')),
  router_maximum_output_tokens integer not null check (router_maximum_output_tokens = 500),
  router_input_micros_per_token numeric(12,4) not null check (router_input_micros_per_token > 0),
  router_output_micros_per_token numeric(12,4) not null check (router_output_micros_per_token > 0),
  router_prompt_version text not null check (router_prompt_version ~ '^momi-router-v[0-9]+$'),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table momi_communications_gateway.routing_profiles (
  route_key text primary key check (route_key in ('quick', 'standard', 'deep', 'maximum')),
  route_rank smallint not null unique check (route_rank between 1 and 4),
  provider_model text not null check (length(provider_model) between 1 and 200),
  reasoning_effort text not null check (reasoning_effort in ('none', 'low', 'medium', 'high', 'xhigh', 'max')),
  maximum_output_tokens integer not null check (maximum_output_tokens between 1 and 32000),
  input_micros_per_token numeric(12,4) not null check (input_micros_per_token > 0),
  output_micros_per_token numeric(12,4) not null check (output_micros_per_token > 0),
  automatic_enabled boolean not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into momi_communications_gateway.routing_policy
  (router_endpoint, answer_endpoint, router_model, router_reasoning_effort,
    router_maximum_output_tokens, router_input_micros_per_token,
    router_output_micros_per_token, router_prompt_version, enabled)
values ('https://api.openai.com/v1/responses', 'https://api.openai.com/v1/responses',
  'gpt-5.6-luna', 'low', 500, 1, 6, 'momi-router-v1', true);

insert into momi_communications_gateway.routing_profiles
  (route_key, route_rank, provider_model, reasoning_effort,
    maximum_output_tokens, input_micros_per_token,
    output_micros_per_token, automatic_enabled, enabled)
values
  ('quick', 1, 'gpt-5.6-luna', 'low', 1000, 1, 6, true, true),
  ('standard', 2, 'gpt-5.6-terra', 'medium', 4000, 2.5, 15, true, true),
  ('deep', 3, 'gpt-5.6-sol', 'high', 8000, 5, 30, true, true),
  ('maximum', 4, 'gpt-5.6-sol', 'max', 16000, 5, 30, false, true);

alter table momi_communications_gateway.user_limits
  add column default_route text not null default 'quick'
    check (default_route in ('quick', 'standard', 'deep', 'maximum')),
  add column maximum_route text not null default 'standard'
    check (maximum_route in ('quick', 'standard', 'deep', 'maximum'));

update momi_communications_gateway.user_limits limits set
  default_route = 'standard', maximum_route = 'maximum'
from momi_communications_gateway.access_entries access
where access.user_id = limits.user_id and access.email = 'zac@doughmonster.com';

alter table momi_communications_gateway.invocations
  drop constraint invocations_provider_calls_check,
  add constraint invocations_provider_calls_check check (provider_calls between 0 and 3),
  add column requested_route text not null default 'auto'
    check (requested_route in ('auto', 'quick', 'standard', 'deep', 'maximum')),
  add column selected_route text
    check (selected_route in ('quick', 'standard', 'deep', 'maximum')),
  add column reasoning_effort text
    check (reasoning_effort in ('none', 'low', 'medium', 'high', 'xhigh', 'max')),
  add column routing_source text
    check (routing_source in ('explicit', 'router', 'fallback')),
  add column routing_reason text check (length(routing_reason) between 1 and 240),
  add column routing_confidence numeric(4,3)
    check (routing_confidence between 0 and 1),
  add column accrued_cost_micros bigint not null default 0
    check (accrued_cost_micros >= 0);

create function momi_communications_gateway.admit_routed_invocation_v2(
  p_user_id uuid, p_email text, p_conversation_id text, p_turn_id text,
  p_alias text, p_idempotency_key text, p_request_hash text,
  p_input_tokens integer, p_requested_route text
)
returns table (
  disposition text, invocation_id uuid, provider_key text, provider_model text,
  provider_endpoint text, maximum_output_tokens integer,
  maximum_input_tokens integer, timeout_seconds integer,
  maximum_attempt_cost_micros bigint, invocation_deadline timestamptz,
  invocation_status text, error_code text
)
language plpgsql security definer set search_path = ''
as $$
declare
  existing momi_communications_gateway.invocations%rowtype;
  binding momi_communications_gateway.provider_bindings%rowtype;
  limits momi_communications_gateway.user_limits%rowtype;
  new_id uuid;
  recent_count integer;
  daily_count integer;
  attempt_count integer;
  initial_model text;
  selected_cost bigint;
  spend bigint;
begin
  if p_requested_route not in ('auto', 'quick', 'standard', 'deep', 'maximum') then
    raise exception 'invalid requested route' using errcode = '22023';
  end if;
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
  if not found then raise exception 'routing limits unavailable' using errcode = '22023'; end if;
  p_input_tokens := p_input_tokens + ceil(length(binding.model)::numeric / 4)::integer;
  if p_input_tokens > limits.maximum_input_tokens then
    raise exception 'effective user limit refused request' using errcode = '22023';
  end if;
  select ceil(max(
    (p_input_tokens * profile.input_micros_per_token) +
    (least(limits.maximum_output_tokens, profile.maximum_output_tokens) *
      profile.output_micros_per_token)
  ))::bigint into selected_cost
  from momi_communications_gateway.routing_profiles profile
  join momi_communications_gateway.routing_profiles ceiling
    on ceiling.route_key = limits.maximum_route
  where profile.enabled and profile.route_rank <= ceiling.route_rank
    and (p_requested_route = 'auto' and profile.automatic_enabled
      or profile.route_key = p_requested_route);
  if selected_cost is null then raise exception 'requested route unavailable' using errcode = '22023'; end if;
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
    maximum_input_tokens := limits.maximum_input_tokens;
    timeout_seconds := limits.timeout_seconds;
    maximum_attempt_cost_micros := existing.per_attempt_cost_micros;
    invocation_deadline := existing.invocation_deadline;
    invocation_status := existing.status; error_code := existing.error_code;
    return next; return;
  end if;
  select count(*) into recent_count from momi_communications_gateway.invocations
    where user_id = p_user_id and started_at >= now() - interval '1 minute';
  select count(*) into daily_count from momi_communications_gateway.invocations
    where user_id = p_user_id and started_at >= date_trunc('day', now());
  select coalesce(sum(case when status in ('completed', 'failed', 'paid_ambiguous')
    then billed_micros else reserved_micros end), 0) into spend
  from momi_communications_gateway.invocations where user_id = p_user_id;
  attempt_count := case when p_requested_route = 'auto' then 3 else 2 end;
  if recent_count >= limits.requests_per_minute or daily_count >= limits.requests_per_day
    or spend + (selected_cost * attempt_count) > limits.budget_micros then
    raise exception 'effective rate or budget limit refused request' using errcode = '22023';
  end if;
  if p_requested_route = 'auto' then
    select router_model into initial_model from momi_communications_gateway.routing_policy
      where singleton and enabled;
  else
    select profile.provider_model into initial_model
    from momi_communications_gateway.routing_profiles profile
    where profile.route_key = p_requested_route and profile.enabled;
  end if;
  if initial_model is null then raise exception 'routing model unavailable' using errcode = '22023'; end if;
  insert into momi_communications_gateway.invocations (
    user_id, conversation_id, turn_id, idempotency_key, request_hash, alias,
    provider_key, provider_model, input_tokens, reserved_micros,
    per_attempt_cost_micros, requested_route, invocation_deadline
  ) values (p_user_id, p_conversation_id, p_turn_id, p_idempotency_key,
    p_request_hash, p_alias, binding.provider_key, initial_model, p_input_tokens,
    selected_cost * attempt_count, selected_cost, p_requested_route,
    now() + make_interval(secs => limits.timeout_seconds))
  returning momi_communications_gateway.invocations.invocation_id into new_id;
  disposition := 'admitted'; invocation_id := new_id;
  provider_key := binding.provider_key; provider_model := initial_model;
  provider_endpoint := binding.endpoint;
  maximum_output_tokens := limits.maximum_output_tokens;
  maximum_input_tokens := limits.maximum_input_tokens;
  timeout_seconds := limits.timeout_seconds;
  maximum_attempt_cost_micros := selected_cost;
  select i.invocation_deadline into invocation_deadline
  from momi_communications_gateway.invocations i where i.invocation_id = new_id;
  invocation_status := 'pending_archive'; error_code := null;
  return next;
end;
$$;

create function momi_communications_gateway.authorize_provider_attempt_v2(
  p_invocation_id uuid, p_payload_tokens integer, p_round integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  invocation momi_communications_gateway.invocations%rowtype;
  limits momi_communications_gateway.user_limits%rowtype;
  attempt_cost bigint;
  other_spend bigint;
begin
  select i.* into invocation from momi_communications_gateway.invocations i
    where i.invocation_id = p_invocation_id;
  if not found then return false; end if;
  select l.* into limits from momi_communications_gateway.user_limits l
    where l.user_id = invocation.user_id for update;
  if not found then return false; end if;
  select i.* into invocation from momi_communications_gateway.invocations i
    where i.invocation_id = p_invocation_id for update;
  if p_round not between 1 and 3 or p_round <> invocation.provider_calls + 1
    or invocation.status not in ('admitted', 'provider_started')
    or invocation.archive_admission_receipt is null
    or now() >= invocation.invocation_deadline
    or p_payload_tokens <= 0 or p_payload_tokens > limits.maximum_input_tokens then
    return false;
  end if;
  if invocation.selected_route is null then
    select ceil(
      (p_payload_tokens * policy.router_input_micros_per_token) +
      (policy.router_maximum_output_tokens * policy.router_output_micros_per_token)
    )::bigint into attempt_cost
    from momi_communications_gateway.routing_policy policy
    where policy.singleton and policy.enabled and invocation.requested_route = 'auto'
      and p_round = 1;
  else
    select ceil(
      (p_payload_tokens * profile.input_micros_per_token) +
      (least(limits.maximum_output_tokens, profile.maximum_output_tokens) *
        profile.output_micros_per_token)
    )::bigint into attempt_cost
    from momi_communications_gateway.routing_profiles profile
    join momi_communications_gateway.routing_profiles ceiling
      on ceiling.route_key = limits.maximum_route
    where profile.route_key = invocation.selected_route and profile.enabled
      and profile.route_rank <= ceiling.route_rank;
  end if;
  if attempt_cost is null then return false; end if;
  select coalesce(sum(case when i.status in ('completed', 'failed', 'paid_ambiguous')
    then i.billed_micros else i.reserved_micros end), 0) into other_spend
  from momi_communications_gateway.invocations i
  where i.user_id = invocation.user_id and i.invocation_id <> p_invocation_id;
  if other_spend + invocation.accrued_cost_micros + attempt_cost > limits.budget_micros then
    return false;
  end if;
  update momi_communications_gateway.invocations i set
    status = 'provider_started',
    provider_started_at = coalesce(i.provider_started_at, now()),
    provider_calls = p_round,
    accrued_cost_micros = i.accrued_cost_micros + attempt_cost,
    per_attempt_cost_micros = greatest(i.per_attempt_cost_micros, attempt_cost),
    reserved_micros = greatest(i.reserved_micros,
      i.accrued_cost_micros + attempt_cost)
  where i.invocation_id = p_invocation_id;
  return found;
end;
$$;

create or replace function momi_communications_gateway.complete_invocation_v1(
  p_invocation_id uuid, p_status text, p_terminal_receipt uuid,
  p_output_tokens integer, p_error_code text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('completed', 'failed', 'paid_ambiguous')
    or (p_status = 'completed' and p_terminal_receipt is null) then
    raise exception 'invalid terminal invocation state' using errcode = '22023';
  end if;
  update momi_communications_gateway.invocations set status = p_status,
    terminal_archive_receipt = p_terminal_receipt,
    output_tokens = greatest(coalesce(p_output_tokens, 0), 0),
    billed_micros = accrued_cost_micros, reserved_micros = 0,
    error_code = p_error_code, completed_at = now()
  where invocation_id = p_invocation_id and status = 'provider_started';
  return found;
end;
$$;

create or replace function momi_communications_gateway.fail_invocation_v1(
  p_invocation_id uuid, p_terminal_receipt uuid, p_error_code text
) returns boolean language sql security definer set search_path = '' as $$
  update momi_communications_gateway.invocations set status = 'failed',
    terminal_archive_receipt = p_terminal_receipt,
    billed_micros = accrued_cost_micros,
    reserved_micros = 0, error_code = p_error_code, completed_at = now()
  where invocation_id = p_invocation_id
    and status in ('admitted', 'provider_started')
    and p_terminal_receipt is not null and p_error_code <> '' returning true
$$;

create function momi_communications_gateway.set_user_routing_v1(
  p_actor uuid, p_admin_authorized boolean, p_user_id uuid,
  p_default_route text, p_maximum_route text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare default_rank smallint; maximum_rank smallint;
begin
  if not p_admin_authorized then raise exception 'Zac administration required' using errcode = '42501'; end if;
  select route_rank into default_rank from momi_communications_gateway.routing_profiles
    where route_key = p_default_route and enabled;
  select route_rank into maximum_rank from momi_communications_gateway.routing_profiles
    where route_key = p_maximum_route and enabled;
  if default_rank is null or maximum_rank is null or default_rank > maximum_rank then
    raise exception 'invalid routing range' using errcode = '22023';
  end if;
  update momi_communications_gateway.user_limits set default_route = p_default_route,
    maximum_route = p_maximum_route, updated_at = now(), updated_by = p_actor
  where user_id = p_user_id;
  if not found then raise exception 'user limits unavailable' using errcode = '22023'; end if;
  insert into momi_communications_gateway.audit_events
    (actor_user_id, target_user_id, action_key, details)
  values (p_actor, p_user_id, 'set_user_routing_v1', jsonb_build_object(
    'default_route', p_default_route, 'maximum_route', p_maximum_route));
  return true;
end;
$$;

alter table momi_communications_gateway.routing_policy enable row level security;
alter table momi_communications_gateway.routing_profiles enable row level security;
revoke all on table momi_communications_gateway.routing_policy,
  momi_communications_gateway.routing_profiles from public, anon, authenticated;
grant select on table momi_communications_gateway.routing_policy,
  momi_communications_gateway.routing_profiles to service_role;
revoke all on function momi_communications_gateway.admit_routed_invocation_v2(
  uuid, text, text, text, text, text, text, integer, text
) from public, anon, authenticated;
revoke all on function momi_communications_gateway.authorize_provider_attempt_v2(
  uuid, integer, integer
) from public, anon, authenticated;
revoke all on function momi_communications_gateway.set_user_routing_v1(
  uuid, boolean, uuid, text, text
) from public, anon, authenticated;
grant execute on function momi_communications_gateway.admit_routed_invocation_v2(
  uuid, text, text, text, text, text, text, integer, text
) to service_role;
grant execute on function momi_communications_gateway.authorize_provider_attempt_v2(
  uuid, integer, integer
) to service_role;
grant execute on function momi_communications_gateway.set_user_routing_v1(
  uuid, boolean, uuid, text, text
) to service_role;
