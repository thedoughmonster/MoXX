-- service-owner: communications-archive

insert into momi_communications.source_types
  (source_type, capture_contract_key, description)
values
  ('momi_gateway', 'momi.communications.capture_gateway_exchange.v1',
   'Exact ordered provider and tool boundary evidence for a MoMi gateway invocation.'),
  ('openwebui_human', 'momi.communications.capture_human_message.v1',
   'Committed user-to-user messages reconciled from persistent OpenWebUI state.')
on conflict (source_type) do nothing;

create function momi_communications.capture_gateway_exchange_v1(
  p_invocation_id uuid, p_user_id uuid, p_conversation_id text, p_turn_id text,
  p_evidence_order integer, p_phase text, p_payload jsonb,
  p_provider_key text, p_provider_model text, p_terminal_status text,
  p_usage jsonb, p_timing jsonb, p_idempotency_key text,
  p_occurred_at timestamptz default now()
)
returns table (disposition text, archive_item_id uuid, content_hash text)
language plpgsql security definer set search_path = ''
as $$
declare
  account_id uuid;
  item_id uuid;
  existing_id uuid;
  existing_hash text;
  computed_hash text;
  message_key text;
begin
  if p_invocation_id is null or p_user_id is null or p_conversation_id = ''
    or p_turn_id = '' or p_evidence_order < 0 or p_phase = ''
    or jsonb_typeof(p_payload) not in ('object', 'array')
    or jsonb_typeof(p_usage) <> 'object' or jsonb_typeof(p_timing) <> 'object'
    or p_idempotency_key = '' then
    raise exception 'gateway archive identity is invalid' using errcode = '22023';
  end if;
  if p_payload::text ~* '"(authorization|api[_-]?key|password|credential|cookie|capability[_-]?token)"[[:space:]]*:'
    or p_payload::text ~* 'sk-(proj-)?[A-Za-z0-9_-]{20,}' then
    raise exception 'protected material is forbidden in archive evidence' using errcode = '22023';
  end if;
  message_key := p_invocation_id::text || ':' || p_evidence_order::text || ':' || p_phase;
  computed_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    p_invocation_id, p_user_id, p_conversation_id, p_turn_id,
    p_evidence_order, p_phase, p_payload, p_provider_key, p_provider_model,
    p_terminal_status, p_usage, p_timing
  )::text, 'UTF8'), 'sha256'), 'hex');
  insert into momi_communications.source_accounts
    (source_type, source_account_key, display_label)
  values ('momi_gateway', 'momi-gateway-v1', 'MoMi communications gateway')
  on conflict (source_type, source_account_key) do nothing
  returning source_account_id into account_id;
  if account_id is null then
    select source_account_id into account_id from momi_communications.source_accounts
    where source_type = 'momi_gateway' and source_account_key = 'momi-gateway-v1';
  end if;
  insert into momi_communications.archive_items (
    source_type, source_account_id, source_account_key, source_user_key,
    source_conversation_key, source_message_key, sender_role, occurred_at,
    source_metadata, payload, content_hash, idempotency_key, capture_actor,
    model_version, tool_version, prompt_version
  ) values (
    'momi_gateway', account_id, 'momi-gateway-v1', p_user_id::text,
    p_conversation_id, message_key, 'gateway', coalesce(p_occurred_at, now()),
    jsonb_build_object('invocation_id', p_invocation_id, 'turn_id', p_turn_id,
      'evidence_order', p_evidence_order, 'phase', p_phase,
      'provider_key', p_provider_key, 'terminal_status', p_terminal_status,
      'usage', p_usage, 'timing', p_timing),
    p_payload, computed_hash, p_idempotency_key, 'communications-gateway-v1',
    p_provider_model, 'momi-beta-tools-v1', 'momi-assistant-v1'
  ) on conflict do nothing returning momi_communications.archive_items.archive_item_id into item_id;
  if item_id is null then
    select archive_item_id, momi_communications.archive_items.content_hash
      into existing_id, existing_hash
    from momi_communications.archive_items
    where source_type = 'momi_gateway' and source_account_key = 'momi-gateway-v1'
      and source_user_key = p_user_id::text and idempotency_key = p_idempotency_key;
    if existing_id is null or existing_hash <> computed_hash then
      raise exception 'gateway archive replay conflicts' using errcode = '23505';
    end if;
    item_id := existing_id; disposition := 'duplicate';
  else disposition := 'stored'; end if;
  archive_item_id := item_id; content_hash := computed_hash; return next;
end;
$$;

create function momi_communications.capture_human_message_v1(
  p_source_account_key text, p_source_user_key text,
  p_source_conversation_key text, p_source_message_key text,
  p_source_parent_message_key text, p_sender_role text,
  p_content text, p_source_metadata jsonb, p_idempotency_key text,
  p_occurred_at timestamptz
)
returns table (disposition text, archive_item_id uuid, content_hash text)
language plpgsql security definer set search_path = ''
as $$
declare
  account_id uuid;
  item_id uuid;
  existing_hash text;
  computed_hash text;
begin
  if p_source_account_key = '' or p_source_user_key = ''
    or p_source_conversation_key = '' or p_source_message_key = ''
    or p_content is null or p_idempotency_key = ''
    or jsonb_typeof(p_source_metadata) <> 'object' then
    raise exception 'human message identity is invalid' using errcode = '22023';
  end if;
  computed_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    p_source_account_key, p_source_user_key, p_source_conversation_key,
    p_source_message_key, p_source_parent_message_key, p_sender_role,
    p_content, p_source_metadata, p_occurred_at
  )::text, 'UTF8'), 'sha256'), 'hex');
  insert into momi_communications.source_accounts
    (source_type, source_account_key, display_label)
  values ('openwebui_human', p_source_account_key, 'OpenWebUI committed messages')
  on conflict (source_type, source_account_key) do nothing
  returning source_account_id into account_id;
  if account_id is null then
    select source_account_id into account_id from momi_communications.source_accounts
    where source_type = 'openwebui_human' and source_account_key = p_source_account_key;
  end if;
  insert into momi_communications.archive_items (
    source_type, source_account_id, source_account_key, source_user_key,
    source_conversation_key, source_message_key, source_parent_message_key,
    sender_role, occurred_at, source_metadata, payload, raw_text,
    content_hash, idempotency_key, capture_actor, tool_version
  ) values (
    'openwebui_human', account_id, p_source_account_key, p_source_user_key,
    p_source_conversation_key, p_source_message_key, p_source_parent_message_key,
    p_sender_role, p_occurred_at, p_source_metadata,
    jsonb_build_object('content', p_content), p_content, computed_hash,
    p_idempotency_key, 'openwebui-human-relay-v1', 'openwebui-human-relay-v1'
  ) on conflict do nothing returning momi_communications.archive_items.archive_item_id into item_id;
  if item_id is null then
    select momi_communications.archive_items.archive_item_id,
      momi_communications.archive_items.content_hash into item_id, existing_hash
    from momi_communications.archive_items where source_type = 'openwebui_human'
      and source_account_key = p_source_account_key
      and source_user_key = p_source_user_key
      and idempotency_key = p_idempotency_key;
    if item_id is null or existing_hash <> computed_hash then
      raise exception 'human message replay conflicts' using errcode = '23505';
    end if;
    disposition := 'duplicate';
  else disposition := 'stored'; end if;
  archive_item_id := item_id; content_hash := computed_hash; return next;
end;
$$;

create function momi_communications.get_gateway_exchange_receipt_v1(
  p_invocation_id uuid, p_user_id uuid
)
returns table (archive_item_id uuid, content_hash text, evidence_order integer,
  phase text, terminal_status text, usage jsonb, timing jsonb, captured_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select item.archive_item_id, item.content_hash,
    (item.source_metadata ->> 'evidence_order')::integer,
    item.source_metadata ->> 'phase', item.source_metadata ->> 'terminal_status',
    item.source_metadata -> 'usage', item.source_metadata -> 'timing', item.captured_at
  from momi_communications.archive_items item
  where item.source_type = 'momi_gateway'
    and item.source_user_key = p_user_id::text
    and item.source_metadata ->> 'invocation_id' = p_invocation_id::text
  order by (item.source_metadata ->> 'evidence_order')::integer, item.archive_item_id
$$;

revoke all on function momi_communications.capture_gateway_exchange_v1(
  uuid, uuid, text, text, integer, text, jsonb, text, text, text,
  jsonb, jsonb, text, timestamptz) from public, anon, authenticated;
revoke all on function momi_communications.capture_human_message_v1(
  text, text, text, text, text, text, text, jsonb, text, timestamptz)
  from public, anon, authenticated;
revoke all on function momi_communications.get_gateway_exchange_receipt_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function momi_communications.capture_gateway_exchange_v1(
  uuid, uuid, text, text, integer, text, jsonb, text, text, text,
  jsonb, jsonb, text, timestamptz) to service_role;
grant execute on function momi_communications.capture_human_message_v1(
  text, text, text, text, text, text, text, jsonb, text, timestamptz)
  to service_role;
grant execute on function momi_communications.get_gateway_exchange_receipt_v1(uuid, uuid)
  to service_role;
