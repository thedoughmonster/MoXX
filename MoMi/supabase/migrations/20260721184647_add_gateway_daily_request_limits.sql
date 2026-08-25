-- service-owner: communications-gateway

alter table momi_communications_gateway.user_limits
  add column requests_per_day integer not null default 50
    check (requests_per_day between 1 and 1000);

create or replace function momi_communications_gateway.admit_invocation_v1(
  p_user_id uuid, p_email text, p_conversation_id text, p_turn_id text,
  p_alias text, p_idempotency_key text, p_request_hash text,
  p_input_tokens integer
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
  p_input_tokens := p_input_tokens + ceil(length(binding.model)::numeric / 4)::integer;
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
    maximum_input_tokens := limits.maximum_input_tokens;
    timeout_seconds := limits.timeout_seconds;
    maximum_attempt_cost_micros := binding.maximum_attempt_cost_micros;
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
  if recent_count >= limits.requests_per_minute
    or daily_count >= limits.requests_per_day
    or binding.maximum_attempt_cost_micros > limits.budget_micros / 2
    or spend + (binding.maximum_attempt_cost_micros * 2) > limits.budget_micros then
    raise exception 'effective rate or budget limit refused request' using errcode = '22023';
  end if;
  insert into momi_communications_gateway.invocations (
    user_id, conversation_id, turn_id, idempotency_key, request_hash, alias,
    provider_key, provider_model, input_tokens, reserved_micros,
    per_attempt_cost_micros, invocation_deadline
  ) values (p_user_id, p_conversation_id, p_turn_id, p_idempotency_key,
    p_request_hash, p_alias, binding.provider_key, binding.model, p_input_tokens,
    binding.maximum_attempt_cost_micros * 2, binding.maximum_attempt_cost_micros,
    now() + make_interval(secs => limits.timeout_seconds))
  returning momi_communications_gateway.invocations.invocation_id into new_id;
  disposition := 'admitted'; invocation_id := new_id;
  provider_key := binding.provider_key; provider_model := binding.model;
  provider_endpoint := binding.endpoint;
  maximum_output_tokens := limits.maximum_output_tokens;
  maximum_input_tokens := limits.maximum_input_tokens;
  timeout_seconds := limits.timeout_seconds;
  maximum_attempt_cost_micros := binding.maximum_attempt_cost_micros;
  select i.invocation_deadline into invocation_deadline
    from momi_communications_gateway.invocations i where i.invocation_id = new_id;
  invocation_status := 'pending_archive'; error_code := null;
  return next;
end;
$$;

drop function momi_communications_gateway.set_user_limits_v1(
  uuid, boolean, uuid, integer, integer, integer, integer, bigint
);

create function momi_communications_gateway.set_user_limits_v1(
  p_actor uuid, p_admin_authorized boolean, p_user_id uuid,
  p_requests_per_minute integer, p_requests_per_day integer,
  p_maximum_input_tokens integer, p_maximum_output_tokens integer,
  p_timeout_seconds integer, p_budget_micros bigint
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not p_admin_authorized then raise exception 'Zac administration required' using errcode = '42501'; end if;
  insert into momi_communications_gateway.user_limits (
    user_id, requests_per_minute, requests_per_day, maximum_input_tokens,
    maximum_output_tokens, timeout_seconds, budget_micros, updated_at, updated_by
  ) values (
    p_user_id, p_requests_per_minute, p_requests_per_day, p_maximum_input_tokens,
    p_maximum_output_tokens, p_timeout_seconds, p_budget_micros, now(), p_actor)
  on conflict (user_id) do update set
    requests_per_minute = excluded.requests_per_minute,
    requests_per_day = excluded.requests_per_day,
    maximum_input_tokens = excluded.maximum_input_tokens,
    maximum_output_tokens = excluded.maximum_output_tokens,
    timeout_seconds = excluded.timeout_seconds, budget_micros = excluded.budget_micros,
    updated_at = now(), updated_by = excluded.updated_by;
  insert into momi_communications_gateway.audit_events
    (actor_user_id, target_user_id, action_key, details)
  values (p_actor, p_user_id, 'set_user_limits_v1', jsonb_build_object(
    'requests_per_minute', p_requests_per_minute,
    'requests_per_day', p_requests_per_day,
    'maximum_input_tokens', p_maximum_input_tokens,
    'maximum_output_tokens', p_maximum_output_tokens,
    'timeout_seconds', p_timeout_seconds, 'budget_micros', p_budget_micros));
  return true;
end;
$$;

revoke all on function momi_communications_gateway.set_user_limits_v1(
  uuid, boolean, uuid, integer, integer, integer, integer, integer, bigint
) from public, anon, authenticated;
grant execute on function momi_communications_gateway.set_user_limits_v1(
  uuid, boolean, uuid, integer, integer, integer, integer, integer, bigint
) to service_role;
