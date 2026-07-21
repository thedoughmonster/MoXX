-- service-owner: communications-operations

create schema momi_communications_operations;

create table momi_communications_operations.user_flag_selections (
  selection_id uuid primary key default gen_random_uuid(),
  selection_source text not null default 'user_flag'
    check (selection_source = 'user_flag'),
  flagged_by_user_id uuid not null,
  flagged_at timestamptz not null default now(),
  selection_scope text not null
    check (selection_scope in ('message', 'turn', 'range', 'conversation')),
  source_conversation_id text not null,
  source_message_id text,
  source_turn_id text,
  source_range jsonb,
  gateway_invocation_id uuid not null,
  archive_receipt_id uuid not null,
  user_note text,
  category text,
  idempotency_key text not null,
  constraint user_flag_idempotency_unique unique (flagged_by_user_id, idempotency_key),
  constraint selected_range_object check (
    source_range is null or jsonb_typeof(source_range) = 'object'
  )
);

create table momi_communications_operations.shop_logs (
  shop_log_id uuid primary key default gen_random_uuid(),
  selection_id uuid not null unique
    references momi_communications_operations.user_flag_selections(selection_id),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  summarizer_model text,
  summarizer_version text,
  created_at timestamptz not null default now()
);

create table momi_communications_operations.log_corrections (
  correction_id uuid primary key default gen_random_uuid(),
  shop_log_id uuid not null references momi_communications_operations.shop_logs(shop_log_id),
  supersedes_correction_id uuid
    references momi_communications_operations.log_corrections(correction_id),
  corrected_by_user_id uuid not null,
  correction jsonb not null check (jsonb_typeof(correction) = 'object'),
  created_at timestamptz not null default now()
);

create table momi_communications_operations.audit_events (
  audit_event_id uuid primary key default gen_random_uuid(),
  selection_id uuid references momi_communications_operations.user_flag_selections(selection_id),
  shop_log_id uuid references momi_communications_operations.shop_logs(shop_log_id),
  actor_user_id uuid not null,
  action_key text not null,
  created_at timestamptz not null default now()
);

create function momi_communications_operations.create_user_flagged_shop_log_v1(
  p_flagged_by_user_id uuid, p_selection_source text, p_selection_scope text,
  p_source_conversation_id text, p_source_message_id text, p_source_turn_id text,
  p_source_range jsonb, p_gateway_invocation_id uuid, p_archive_receipt_id uuid,
  p_user_note text, p_category text, p_log_content jsonb,
  p_summarizer_model text, p_summarizer_version text, p_idempotency_key text
)
returns table (disposition text, selection_id uuid, shop_log_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  selected_id uuid;
  created_log_id uuid;
begin
  if p_selection_source <> 'user_flag'
    or p_selection_scope not in ('message', 'turn', 'range', 'conversation')
    or p_source_conversation_id = '' or p_idempotency_key = ''
    or jsonb_typeof(p_log_content) <> 'object'
    or (p_source_range is not null and jsonb_typeof(p_source_range) <> 'object') then
    raise exception 'explicit user flag selection is invalid' using errcode = '22023';
  end if;
  if (p_selection_scope = 'message' and (
      coalesce(p_source_message_id, '') = '' or p_source_range is not null
      or not (p_log_content ? 'selected_content')))
    or (p_selection_scope = 'turn' and (
      coalesce(p_source_turn_id, '') = '' or p_source_message_id is not null
      or p_source_range is not null or not (p_log_content ? 'selected_content')))
    or (p_selection_scope = 'range' and (
      p_source_message_id is not null or p_source_range is null
      or jsonb_typeof(p_source_range -> 'start') <> 'number'
      or jsonb_typeof(p_source_range -> 'end') <> 'number'
      or (p_source_range ->> 'start')::integer < 0
      or (p_source_range ->> 'end')::integer <= (p_source_range ->> 'start')::integer
      or not (p_log_content ? 'selected_content')))
    or (p_selection_scope = 'conversation' and (
      p_source_message_id is not null or p_source_range is not null
      or jsonb_typeof(p_log_content -> 'messages') <> 'array')) then
    raise exception 'scope-specific user selection is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from momi_communications.get_gateway_exchange_receipt_v1(
      p_gateway_invocation_id, p_flagged_by_user_id
    ) receipt where receipt.archive_item_id = p_archive_receipt_id
  ) then
    raise exception 'archive receipt does not belong to authenticated user invocation'
      using errcode = '42501';
  end if;
  select selection.selection_id, log.shop_log_id into selected_id, created_log_id
  from momi_communications_operations.user_flag_selections selection
  join momi_communications_operations.shop_logs log using (selection_id)
  where selection.flagged_by_user_id = p_flagged_by_user_id
    and selection.idempotency_key = p_idempotency_key;
  if found then
    disposition := 'duplicate'; selection_id := selected_id;
    shop_log_id := created_log_id; return next; return;
  end if;
  insert into momi_communications_operations.user_flag_selections (
    selection_source, flagged_by_user_id, selection_scope,
    source_conversation_id, source_message_id, source_turn_id, source_range,
    gateway_invocation_id, archive_receipt_id, user_note, category, idempotency_key
  ) values (
    'user_flag', p_flagged_by_user_id, p_selection_scope,
    p_source_conversation_id, p_source_message_id, p_source_turn_id, p_source_range,
    p_gateway_invocation_id, p_archive_receipt_id, p_user_note, p_category,
    p_idempotency_key
  ) returning momi_communications_operations.user_flag_selections.selection_id into selected_id;
  insert into momi_communications_operations.shop_logs
    (selection_id, content, summarizer_model, summarizer_version)
  values (selected_id, p_log_content, p_summarizer_model, p_summarizer_version)
  returning momi_communications_operations.shop_logs.shop_log_id into created_log_id;
  insert into momi_communications_operations.audit_events
    (selection_id, shop_log_id, actor_user_id, action_key)
  values (selected_id, created_log_id, p_flagged_by_user_id,
    'create_user_flagged_shop_log_v1');
  disposition := 'stored'; selection_id := selected_id;
  shop_log_id := created_log_id; return next;
end;
$$;

alter table momi_communications_operations.user_flag_selections enable row level security;
alter table momi_communications_operations.shop_logs enable row level security;
alter table momi_communications_operations.log_corrections enable row level security;
alter table momi_communications_operations.audit_events enable row level security;
revoke all on schema momi_communications_operations from public, anon, authenticated;
revoke all on all tables in schema momi_communications_operations from public, anon, authenticated;
revoke all on all sequences in schema momi_communications_operations from public, anon, authenticated;
revoke all on all functions in schema momi_communications_operations from public, anon, authenticated;
grant usage on schema momi_communications_operations to service_role;
grant execute on function momi_communications_operations.create_user_flagged_shop_log_v1(
  uuid, text, text, text, text, text, jsonb, uuid, uuid, text, text,
  jsonb, text, text, text
) to service_role;
