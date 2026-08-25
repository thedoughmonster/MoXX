-- service-owner: communications-gateway

create function momi_communications_gateway.admit_log_invocation_v1(
  p_user_id uuid, p_email text, p_conversation_id text, p_turn_id text,
  p_alias text, p_idempotency_key text, p_request_hash text,
  p_input_tokens integer
)
returns table (
  disposition text, invocation_id uuid, invocation_status text, error_code text
)
language plpgsql security definer set search_path = ''
as $$
declare
  existing momi_communications_gateway.invocations%rowtype;
  limits momi_communications_gateway.user_limits%rowtype;
  new_id uuid;
  recent_count integer;
  daily_count integer;
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
  select * into limits from momi_communications_gateway.user_limits
    where user_id = p_user_id for update;
  if not found or p_input_tokens <= 0
    or p_input_tokens > limits.maximum_input_tokens then
    raise exception 'effective user limit refused request' using errcode = '22023';
  end if;
  select * into existing from momi_communications_gateway.invocations
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if existing.request_hash <> p_request_hash
      or existing.provider_key <> 'momi-internal'
      or existing.provider_model <> 'provider-free-log' then
      raise exception 'idempotency key conflicts with request' using errcode = '23505';
    end if;
    disposition := 'duplicate';
    invocation_id := existing.invocation_id;
    invocation_status := existing.status;
    error_code := existing.error_code;
    return next;
    return;
  end if;
  select count(*) into recent_count from momi_communications_gateway.invocations
    where user_id = p_user_id and started_at >= now() - interval '1 minute';
  select count(*) into daily_count from momi_communications_gateway.invocations
    where user_id = p_user_id and started_at >= date_trunc('day', now());
  if recent_count >= limits.requests_per_minute
    or daily_count >= limits.requests_per_day then
    raise exception 'effective rate limit refused request' using errcode = '22023';
  end if;
  insert into momi_communications_gateway.invocations (
    user_id, conversation_id, turn_id, idempotency_key, request_hash, alias,
    provider_key, provider_model, input_tokens, reserved_micros,
    per_attempt_cost_micros, accrued_cost_micros, invocation_deadline
  ) values (
    p_user_id, p_conversation_id, p_turn_id, p_idempotency_key, p_request_hash,
    p_alias, 'momi-internal', 'provider-free-log', p_input_tokens, 0, 0, 0,
    now() + make_interval(secs => limits.timeout_seconds)
  )
  returning momi_communications_gateway.invocations.invocation_id into new_id;
  disposition := 'admitted';
  invocation_id := new_id;
  invocation_status := 'pending_archive';
  error_code := null;
  return next;
end;
$$;

create function momi_communications_gateway.complete_log_invocation_v1(
  p_invocation_id uuid, p_terminal_receipt uuid, p_terminal_response jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_terminal_receipt is null
    or p_terminal_response is null
    or jsonb_typeof(p_terminal_response) is distinct from 'object'
    or p_terminal_response ->> 'id' is distinct from p_invocation_id::text
    or p_terminal_response ->> 'object' is distinct from 'momi.log'
    or p_terminal_response ->> 'model' is distinct from 'momi-assistant'
    or p_terminal_response ->> 'status' is distinct from 'completed'
    or jsonb_typeof(p_terminal_response -> 'disposition') is distinct from 'string'
    or p_terminal_response ->> 'disposition' not in ('stored', 'duplicate')
    or jsonb_typeof(p_terminal_response -> 'selection_id') is distinct from 'string'
    or jsonb_typeof(p_terminal_response -> 'shop_log_id') is distinct from 'string'
    or length(p_terminal_response ->> 'selection_id') = 0
    or length(p_terminal_response ->> 'shop_log_id') = 0 then
    raise exception 'invalid terminal log state' using errcode = '22023';
  end if;
  update momi_communications_gateway.invocations set
    status = 'completed',
    terminal_archive_receipt = p_terminal_receipt,
    terminal_response = p_terminal_response,
    output_tokens = 0,
    billed_micros = 0,
    reserved_micros = 0,
    accrued_cost_micros = 0,
    error_code = null,
    completed_at = now()
  where invocation_id = p_invocation_id
    and status = 'admitted'
    and provider_key = 'momi-internal'
    and provider_model = 'provider-free-log'
    and provider_calls = 0;
  return found;
end;
$$;

revoke all on function momi_communications_gateway.admit_log_invocation_v1(
  uuid, text, text, text, text, text, text, integer
) from public, anon, authenticated;
revoke all on function momi_communications_gateway.complete_log_invocation_v1(
  uuid, uuid, jsonb
) from public, anon, authenticated;
grant execute on function momi_communications_gateway.admit_log_invocation_v1(
  uuid, text, text, text, text, text, text, integer
) to service_role;
grant execute on function momi_communications_gateway.complete_log_invocation_v1(
  uuid, uuid, jsonb
) to service_role;
