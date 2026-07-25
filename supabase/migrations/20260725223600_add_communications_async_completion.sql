-- service-owner: communications-gateway

alter table momi_communications_gateway.invocations
  add column async_deadline timestamptz;

create table momi_communications_gateway.async_rounds (
  async_round_id uuid primary key default gen_random_uuid(),
  invocation_id uuid not null references momi_communications_gateway.invocations(invocation_id),
  gateway_call_id uuid not null unique,
  provider_response_id text not null unique check (length(provider_response_id) between 1 and 240),
  input_payload jsonb not null check (jsonb_typeof(input_payload) = 'object'),
  request_payload jsonb not null check (jsonb_typeof(request_payload) = 'object'),
  route_key text not null check (route_key in ('quick', 'standard', 'deep', 'maximum')),
  answer_round integer not null check (answer_round between 1 and 12),
  provider_round integer not null check (provider_round between 1 and 13),
  evidence_order integer not null check (evidence_order between 1 and 100),
  provider_model text not null check (length(provider_model) between 1 and 200),
  archive_receipt_id uuid not null,
  round_status text not null default 'pending' check (round_status in (
    'pending', 'claimed', 'continued', 'completed', 'failed'
  )),
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count between 0 and 8),
  next_attempt_at timestamptz not null default now(),
  last_error_code text check (last_error_code is null or length(last_error_code) <= 120),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (invocation_id, answer_round)
);

create table momi_communications_gateway.openwebui_deliveries (
  delivery_id uuid primary key default gen_random_uuid(),
  invocation_id uuid not null unique references momi_communications_gateway.invocations(invocation_id),
  user_id uuid not null,
  conversation_id text not null check (length(conversation_id) between 1 and 256),
  turn_id text not null check (length(turn_id) between 1 and 256),
  content text not null check (length(content) between 1 and 240000),
  delivery_status text not null default 'pending' check (delivery_status in (
    'pending', 'claimed', 'delivered', 'dead_letter'
  )),
  capability_token uuid not null default gen_random_uuid() unique,
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_error_code text check (last_error_code is null or length(last_error_code) <= 120),
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index openwebui_deliveries_due_idx
  on momi_communications_gateway.openwebui_deliveries (next_attempt_at, delivery_id)
  where delivery_status in ('pending', 'claimed');

alter table momi_communications_gateway.async_rounds enable row level security;
alter table momi_communications_gateway.openwebui_deliveries enable row level security;
revoke all on table momi_communications_gateway.async_rounds,
  momi_communications_gateway.openwebui_deliveries
  from public, anon, authenticated;

create function momi_communications_gateway.stage_async_round_v1(
  p_invocation_id uuid, p_gateway_call_id uuid, p_provider_response_id text,
  p_input_payload jsonb, p_request_payload jsonb, p_route_key text,
  p_answer_round integer, p_provider_round integer, p_evidence_order integer,
  p_provider_model text, p_archive_receipt_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare invocation momi_communications_gateway.invocations%rowtype;
begin
  select * into invocation from momi_communications_gateway.invocations
    where invocation_id = p_invocation_id for update;
  if not found or invocation.status <> 'provider_started'
    or p_route_key <> 'maximum'
    or jsonb_typeof(p_input_payload) <> 'object'
    or jsonb_typeof(p_request_payload) <> 'object'
    or p_input_payload -> 'user' ->> 'id' <> invocation.user_id::text
    or p_input_payload ->> 'conversation_id' <> invocation.conversation_id
    or p_input_payload ->> 'turn_id' <> invocation.turn_id
    or p_gateway_call_id is null or p_provider_response_id is null
    or p_archive_receipt_id is null then return false;
  end if;
  insert into momi_communications_gateway.async_rounds (
    invocation_id, gateway_call_id, provider_response_id, input_payload,
    request_payload, route_key, answer_round, provider_round, evidence_order,
    provider_model, archive_receipt_id
  ) values (
    p_invocation_id, p_gateway_call_id, p_provider_response_id,
    p_input_payload, p_request_payload, p_route_key, p_answer_round,
    p_provider_round, p_evidence_order, p_provider_model, p_archive_receipt_id
  ) on conflict (gateway_call_id) do nothing;
  if not found then return exists (
    select 1 from momi_communications_gateway.async_rounds round
    where round.gateway_call_id = p_gateway_call_id
      and round.invocation_id = p_invocation_id
      and round.provider_response_id = p_provider_response_id
  ); end if;
  update momi_communications_gateway.invocations set
    async_deadline = greatest(coalesce(async_deadline, now()), now() + interval '10 minutes')
  where invocation_id = p_invocation_id;
  return true;
end;
$$;

create function momi_communications_gateway.claim_async_round_v1(
  p_gateway_call_id uuid, p_provider_response_id text
) returns table (
  async_round_id uuid, lease_token uuid, invocation_id uuid,
  input_payload jsonb, request_payload jsonb, route_key text,
  answer_round integer, provider_round integer, evidence_order integer,
  provider_model text, archive_receipt_id uuid, async_deadline timestamptz,
  maximum_output_tokens integer
) language plpgsql security definer set search_path = '' as $$
declare selected momi_communications_gateway.async_rounds%rowtype;
begin
  update momi_communications_gateway.async_rounds round set
    round_status = 'claimed', lease_token = gen_random_uuid(),
    lease_expires_at = now() + interval '120 seconds',
    attempt_count = round.attempt_count + 1, last_error_code = null
  where round.gateway_call_id = p_gateway_call_id
    and round.provider_response_id = p_provider_response_id
    and round.attempt_count < 8
    and ((round.round_status = 'pending' and round.next_attempt_at <= now())
      or (round.round_status = 'claimed' and round.lease_expires_at <= now()))
  returning round.* into selected;
  if not found then return; end if;
  return query select selected.async_round_id, selected.lease_token,
    selected.invocation_id, selected.input_payload, selected.request_payload,
    selected.route_key, selected.answer_round, selected.provider_round,
    selected.evidence_order, selected.provider_model, selected.archive_receipt_id,
    invocation.async_deadline,
    least(limits.maximum_output_tokens, profile.maximum_output_tokens)
  from momi_communications_gateway.invocations invocation
  join momi_communications_gateway.user_limits limits
    on limits.user_id = invocation.user_id
  join momi_communications_gateway.routing_profiles profile
    on profile.route_key = selected.route_key and profile.enabled
  where invocation.invocation_id = selected.invocation_id
    and invocation.status = 'provider_started'
    and invocation.async_deadline > now();
end;
$$;

create function momi_communications_gateway.continue_async_round_v1(
  p_async_round_id uuid, p_lease_token uuid,
  p_gateway_call_id uuid, p_provider_response_id text,
  p_request_payload jsonb, p_answer_round integer, p_provider_round integer,
  p_evidence_order integer, p_provider_model text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare current_round momi_communications_gateway.async_rounds%rowtype;
begin
  select * into current_round from momi_communications_gateway.async_rounds
  where async_round_id = p_async_round_id and lease_token = p_lease_token
    and round_status = 'claimed' and lease_expires_at > now() for update;
  if not found or p_answer_round <> current_round.answer_round + 1
    or p_provider_round <> current_round.provider_round + 1
    or jsonb_typeof(p_request_payload) <> 'object' then return false; end if;
  update momi_communications_gateway.async_rounds set
    round_status = 'continued', lease_expires_at = null, completed_at = now()
  where async_round_id = p_async_round_id;
  insert into momi_communications_gateway.async_rounds (
    invocation_id, gateway_call_id, provider_response_id, input_payload,
    request_payload, route_key, answer_round, provider_round, evidence_order,
    provider_model, archive_receipt_id
  ) values (
    current_round.invocation_id, p_gateway_call_id, p_provider_response_id,
    current_round.input_payload, p_request_payload, current_round.route_key,
    p_answer_round, p_provider_round, p_evidence_order, p_provider_model,
    current_round.archive_receipt_id
  );
  return true;
end;
$$;

create function momi_communications_gateway.retry_async_round_v1(
  p_async_round_id uuid, p_lease_token uuid, p_error_code text
) returns boolean language sql security definer set search_path = '' as $$
  update momi_communications_gateway.async_rounds round set
    round_status = case when round.attempt_count >= 8 then 'failed' else 'pending' end,
    next_attempt_at = now() + make_interval(secs => least(120,
      5 * (2 ^ greatest(round.attempt_count - 1, 0))::integer)),
    lease_token = null, lease_expires_at = null,
    last_error_code = left(coalesce(nullif(p_error_code, ''), 'async_round_failed'), 120),
    completed_at = case when round.attempt_count >= 8 then now() else null end
  where round.async_round_id = p_async_round_id
    and round.lease_token = p_lease_token and round.round_status = 'claimed'
    returning true
$$;

create function momi_communications_gateway.finish_async_round_v1(
  p_async_round_id uuid, p_lease_token uuid, p_status text,
  p_terminal_receipt uuid, p_output_tokens integer, p_error_code text,
  p_terminal_response jsonb, p_visible_content text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare current_round momi_communications_gateway.async_rounds%rowtype;
declare invocation momi_communications_gateway.invocations%rowtype;
begin
  if p_status not in ('completed', 'failed', 'paid_ambiguous')
    or p_terminal_receipt is null or p_visible_content is null
    or length(p_visible_content) not between 1 and 240000
    or (p_status = 'completed' and jsonb_typeof(p_terminal_response) <> 'object') then
    raise exception 'invalid asynchronous completion' using errcode = '22023';
  end if;
  select * into current_round from momi_communications_gateway.async_rounds
    where async_round_id = p_async_round_id and lease_token = p_lease_token
      and round_status = 'claimed' and lease_expires_at > now() for update;
  if not found then return false; end if;
  select * into invocation from momi_communications_gateway.invocations
    where invocation_id = current_round.invocation_id for update;
  if not found or invocation.status <> 'provider_started' then return false; end if;
  update momi_communications_gateway.invocations set
    status = p_status, terminal_archive_receipt = p_terminal_receipt,
    output_tokens = greatest(coalesce(p_output_tokens, 0), 0),
    billed_micros = accrued_cost_micros, reserved_micros = 0,
    error_code = p_error_code, terminal_response = p_terminal_response,
    completed_at = now()
  where invocation_id = invocation.invocation_id;
  update momi_communications_gateway.async_rounds set
    round_status = case when p_status = 'completed' then 'completed' else 'failed' end,
    lease_expires_at = null, completed_at = now(), last_error_code = p_error_code
  where async_round_id = p_async_round_id;
  insert into momi_communications_gateway.openwebui_deliveries (
    invocation_id, user_id, conversation_id, turn_id, content
  ) values (
    invocation.invocation_id, invocation.user_id, invocation.conversation_id,
    invocation.turn_id, p_visible_content
  ) on conflict (invocation_id) do nothing;
  return true;
end;
$$;

create function momi_communications_gateway.claim_openwebui_delivery_v1()
returns table (
  delivery_id uuid, capability_token uuid, user_id uuid,
  conversation_id text, turn_id text, content text
) language plpgsql security definer set search_path = '' as $$
declare selected momi_communications_gateway.openwebui_deliveries%rowtype;
begin
  select * into selected from momi_communications_gateway.openwebui_deliveries delivery
  where delivery.attempt_count < 20 and (
    (delivery.delivery_status = 'pending' and delivery.next_attempt_at <= now())
    or (delivery.delivery_status = 'claimed' and delivery.lease_expires_at <= now())
  ) order by delivery.next_attempt_at, delivery.delivery_id
  limit 1 for update skip locked;
  if not found then return; end if;
  update momi_communications_gateway.openwebui_deliveries delivery set
    delivery_status = 'claimed', capability_token = gen_random_uuid(),
    attempt_count = delivery.attempt_count + 1,
    lease_expires_at = now() + interval '30 seconds', last_error_code = null
  where delivery.delivery_id = selected.delivery_id returning
    delivery.delivery_id, delivery.capability_token, delivery.user_id,
    delivery.conversation_id, delivery.turn_id, delivery.content
  into delivery_id, capability_token, user_id, conversation_id, turn_id, content;
  return next;
end;
$$;

create function momi_communications_gateway.ack_openwebui_delivery_v1(
  p_delivery_id uuid, p_capability_token uuid, p_disposition text
) returns boolean language sql security definer set search_path = '' as $$
  update momi_communications_gateway.openwebui_deliveries delivery set
    delivery_status = 'delivered', lease_expires_at = null,
    delivered_at = now(), last_error_code = null
  where delivery.delivery_id = p_delivery_id
    and delivery.capability_token = p_capability_token
    and delivery.delivery_status = 'claimed'
    and p_disposition in ('applied', 'duplicate') returning true
$$;

create function momi_communications_gateway.retry_openwebui_delivery_v1(
  p_delivery_id uuid, p_capability_token uuid, p_error_code text
) returns boolean language sql security definer set search_path = '' as $$
  update momi_communications_gateway.openwebui_deliveries delivery set
    delivery_status = case when delivery.attempt_count >= 20
      then 'dead_letter' else 'pending' end,
    next_attempt_at = now() + interval '5 seconds', lease_expires_at = null,
    capability_token = gen_random_uuid(),
    last_error_code = left(coalesce(nullif(p_error_code, ''), 'delivery_failed'), 120)
  where delivery.delivery_id = p_delivery_id
    and delivery.capability_token = p_capability_token
    and delivery.delivery_status = 'claimed' returning true
$$;

create or replace function momi_communications_gateway.authorize_provider_attempt_v2(
  p_invocation_id uuid, p_payload_tokens integer, p_round integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  invocation momi_communications_gateway.invocations%rowtype;
  limits momi_communications_gateway.user_limits%rowtype;
  attempt_cost bigint; other_spend bigint; answer_call integer;
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
    or now() >= coalesce(invocation.async_deadline, invocation.invocation_deadline)
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
    select ceil((p_payload_tokens * policy.router_input_micros_per_token) +
      (policy.router_maximum_output_tokens * policy.router_output_micros_per_token))::bigint
    into attempt_cost from momi_communications_gateway.routing_policy policy
    where policy.singleton and policy.enabled;
  else
    select ceil((p_payload_tokens * profile.input_micros_per_token) +
      (least(limits.maximum_output_tokens, profile.maximum_output_tokens) *
        profile.output_micros_per_token))::bigint into attempt_cost
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

revoke all on function momi_communications_gateway.stage_async_round_v1(
  uuid, uuid, text, jsonb, jsonb, text, integer, integer, integer, text, uuid),
  momi_communications_gateway.claim_async_round_v1(uuid, text),
  momi_communications_gateway.continue_async_round_v1(
    uuid, uuid, uuid, text, jsonb, integer, integer, integer, text),
  momi_communications_gateway.retry_async_round_v1(uuid, uuid, text),
  momi_communications_gateway.finish_async_round_v1(
    uuid, uuid, text, uuid, integer, text, jsonb, text),
  momi_communications_gateway.claim_openwebui_delivery_v1(),
  momi_communications_gateway.ack_openwebui_delivery_v1(uuid, uuid, text),
  momi_communications_gateway.retry_openwebui_delivery_v1(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function momi_communications_gateway.stage_async_round_v1(
  uuid, uuid, text, jsonb, jsonb, text, integer, integer, integer, text, uuid),
  momi_communications_gateway.claim_async_round_v1(uuid, text),
  momi_communications_gateway.continue_async_round_v1(
    uuid, uuid, uuid, text, jsonb, integer, integer, integer, text),
  momi_communications_gateway.retry_async_round_v1(uuid, uuid, text),
  momi_communications_gateway.finish_async_round_v1(
    uuid, uuid, text, uuid, integer, text, jsonb, text),
  momi_communications_gateway.claim_openwebui_delivery_v1(),
  momi_communications_gateway.ack_openwebui_delivery_v1(uuid, uuid, text),
  momi_communications_gateway.retry_openwebui_delivery_v1(uuid, uuid, text)
  to service_role;
