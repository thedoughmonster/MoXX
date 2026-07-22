-- service-owner: communications-gateway

alter table momi_communications_gateway.routing_profiles
  add column maximum_answer_calls integer not null default 2
    check (maximum_answer_calls between 1 and 12);

update momi_communications_gateway.routing_profiles set maximum_answer_calls =
  case route_key
    when 'quick' then 2
    when 'standard' then 3
    when 'deep' then 4
    when 'maximum' then 6
  end;

alter table momi_communications_gateway.invocations
  drop constraint invocations_provider_calls_check,
  add constraint invocations_provider_calls_check
    check (provider_calls between 0 and 13),
  add column maximum_answer_calls integer not null default 2
    check (maximum_answer_calls between 1 and 12);

create or replace function momi_communications_gateway.admit_routed_invocation_v2(
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
  ))::bigint,
  max(profile.maximum_answer_calls) + case when p_requested_route = 'auto' then 1 else 0 end
  into selected_cost, attempt_count
  from momi_communications_gateway.routing_profiles profile
  join momi_communications_gateway.routing_profiles ceiling
    on ceiling.route_key = limits.maximum_route
  where profile.enabled and profile.route_rank <= ceiling.route_rank
    and (p_requested_route = 'auto' and profile.automatic_enabled
      or profile.route_key = p_requested_route);
  if selected_cost is null or attempt_count is null then
    raise exception 'requested route unavailable' using errcode = '22023';
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

create or replace function momi_communications_gateway.authorize_provider_attempt_v2(
  p_invocation_id uuid, p_payload_tokens integer, p_round integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  invocation momi_communications_gateway.invocations%rowtype;
  limits momi_communications_gateway.user_limits%rowtype;
  attempt_cost bigint;
  other_spend bigint;
  answer_call integer;
begin
  select i.* into invocation from momi_communications_gateway.invocations i
    where i.invocation_id = p_invocation_id;
  if not found then return false; end if;
  select l.* into limits from momi_communications_gateway.user_limits l
    where l.user_id = invocation.user_id for update;
  if not found then return false; end if;
  select i.* into invocation from momi_communications_gateway.invocations i
    where i.invocation_id = p_invocation_id for update;
  if p_round <= 0 or p_round <> invocation.provider_calls + 1
    or invocation.status not in ('admitted', 'provider_started')
    or invocation.archive_admission_receipt is null
    or now() >= invocation.invocation_deadline
    or p_payload_tokens <= 0 or p_payload_tokens > limits.maximum_input_tokens then
    return false;
  end if;
  if invocation.selected_route is null then
    if invocation.requested_route <> 'auto' or p_round <> 1 then return false; end if;
  else
    answer_call := p_round - case when invocation.requested_route = 'auto' then 1 else 0 end;
    if answer_call <= 0 or answer_call > invocation.maximum_answer_calls then return false; end if;
  end if;
  if invocation.selected_route is null then
    select ceil(
      (p_payload_tokens * policy.router_input_micros_per_token) +
      (policy.router_maximum_output_tokens * policy.router_output_micros_per_token)
    )::bigint into attempt_cost
    from momi_communications_gateway.routing_policy policy
    where policy.singleton and policy.enabled;
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
