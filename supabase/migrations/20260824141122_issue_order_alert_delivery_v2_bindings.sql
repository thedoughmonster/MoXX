-- service-owner: order-alerting

create function momi_alerting.issue_order_read_capability_v2(
  p_api_work_id bigint,
  p_attempt_id bigint,
  p_invocation_id uuid,
  p_event_id uuid,
  p_message_id bigint,
  p_delivery_capability_token uuid
)
returns table (read_work_id text, capability_token uuid)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_issued record;
  v_bound boolean;
begin
  select issued.read_work_id, issued.capability_token
  into strict v_issued
  from momi_alerting.issue_order_read_capability(
    p_api_work_id, p_attempt_id, p_invocation_id, p_event_id,
    p_message_id, p_delivery_capability_token
  ) as issued;

  select momi_api.bind_order_alert_delivery_v2(
    v_issued.read_work_id::bigint, v_issued.capability_token,
    p_event_id, p_message_id, p_delivery_capability_token
  ) into strict v_bound;

  if v_bound is not true then
    raise exception using errcode = '42501',
      message = 'Canonical read capability binding is unavailable';
  end if;

  return query select v_issued.read_work_id, v_issued.capability_token;
end;
$$;

comment on function momi_alerting.issue_order_read_capability_v2(
  bigint, bigint, uuid, uuid, bigint, uuid
) is 'Issues legacy v1 once and binds the exact result to delivery v2.';

revoke all on function momi_alerting.issue_order_read_capability_v2(
  bigint, bigint, uuid, uuid, bigint, uuid
) from public, anon, authenticated, service_role;
