-- service-owner: communications-gateway

alter table momi_communications_gateway.invocations
  add column terminal_response jsonb,
  add constraint invocation_terminal_response_valid check (
    terminal_response is null
    or (status = 'completed' and jsonb_typeof(terminal_response) = 'object')
  );

create function momi_communications_gateway.complete_invocation_v2(
  p_invocation_id uuid, p_status text, p_terminal_receipt uuid,
  p_output_tokens integer, p_error_code text, p_terminal_response jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('completed', 'failed', 'paid_ambiguous')
    or p_terminal_receipt is null
    or (p_status <> 'completed' and p_terminal_response is not null)
    or (p_status = 'completed' and (
      p_terminal_response is null
      or jsonb_typeof(p_terminal_response) is distinct from 'object'
      or p_terminal_response ->> 'id' is distinct from p_invocation_id::text
      or p_terminal_response ->> 'object' is distinct from 'chat.completion'
      or p_terminal_response ->> 'model' is distinct from 'momi-assistant'
      or jsonb_typeof(p_terminal_response -> 'choices') is distinct from 'array'
      or jsonb_array_length(p_terminal_response -> 'choices') <> 1
      or p_terminal_response #>> '{choices,0,message,role}'
        is distinct from 'assistant'
      or jsonb_typeof(p_terminal_response #> '{choices,0,message,content}')
        is distinct from 'string'
      or length(btrim(coalesce(
        p_terminal_response #>> '{choices,0,message,content}', ''
      ))) = 0
    )) then
    raise exception 'invalid terminal invocation state' using errcode = '22023';
  end if;
  update momi_communications_gateway.invocations set status = p_status,
    terminal_archive_receipt = p_terminal_receipt,
    terminal_response = p_terminal_response,
    output_tokens = greatest(coalesce(p_output_tokens, 0), 0),
    billed_micros = accrued_cost_micros, reserved_micros = 0,
    error_code = p_error_code, completed_at = now()
  where invocation_id = p_invocation_id and status = 'provider_started';
  return found;
end;
$$;

create function momi_communications_gateway.get_invocation_replay_v1(
  p_invocation_id uuid, p_user_id uuid, p_conversation_id text,
  p_turn_id text, p_request_hash text
) returns table (
  invocation_status text, error_code text, terminal_response jsonb,
  provider_calls integer
) language sql security definer set search_path = '' stable as $$
  select invocation.status, invocation.error_code,
    invocation.terminal_response, invocation.provider_calls
  from momi_communications_gateway.invocations invocation
  where invocation.invocation_id = p_invocation_id
    and invocation.user_id = p_user_id
    and invocation.conversation_id = p_conversation_id
    and invocation.turn_id = p_turn_id
    and invocation.request_hash = p_request_hash
$$;

revoke all on function momi_communications_gateway.complete_invocation_v2(
  uuid, text, uuid, integer, text, jsonb
) from public, anon, authenticated;
revoke all on function momi_communications_gateway.get_invocation_replay_v1(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function momi_communications_gateway.complete_invocation_v2(
  uuid, text, uuid, integer, text, jsonb
) to service_role;
grant execute on function momi_communications_gateway.get_invocation_replay_v1(
  uuid, uuid, text, text, text
) to service_role;
