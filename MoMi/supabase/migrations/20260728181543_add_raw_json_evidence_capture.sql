-- service-owner: communications-archive

insert into momi_communications.source_types
  (source_type, capture_contract_key, description)
values (
  'trello_webhook',
  'momi.raw_json.capture_evidence.v1',
  'Complete authenticated Trello webhook evidence.'
)
on conflict (source_type) do nothing;

create unique index archive_items_trello_action_unique
on momi_communications.archive_items (
  source_type,
  source_account_key,
  idempotency_key
)
where source_type = 'trello_webhook';

create function momi_communications.capture_raw_json_evidence_v1(
  p_source_type text,
  p_source_account_key text,
  p_source_user_key text,
  p_source_conversation_key text,
  p_source_message_key text,
  p_sender_role text,
  p_occurred_at timestamptz,
  p_source_metadata jsonb,
  p_payload jsonb,
  p_raw_text text,
  p_idempotency_key text,
  p_capture_actor text,
  p_tool_version text
)
returns table (disposition text, archive_item_id uuid, content_hash text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid;
  inserted_id uuid;
  existing_id uuid;
  existing_hash text;
  computed_hash text;
begin
  if nullif(p_source_type, '') is null
    or nullif(p_source_account_key, '') is null
    or nullif(p_source_user_key, '') is null
    or nullif(p_source_conversation_key, '') is null
    or nullif(p_source_message_key, '') is null
    or nullif(p_sender_role, '') is null
    or p_occurred_at is null
    or jsonb_typeof(p_source_metadata) <> 'object'
    or jsonb_typeof(p_payload) not in ('object', 'array')
    or p_raw_text is null
    or nullif(p_idempotency_key, '') is null
    or nullif(p_capture_actor, '') is null
    or nullif(p_tool_version, '') is null
    or length(p_source_account_key) > 256
    or length(p_source_user_key) > 256
    or length(p_source_conversation_key) > 256
    or length(p_source_message_key) > 256
    or length(p_idempotency_key) > 512
    or exists (
      select 1 from jsonb_object_keys(p_source_metadata) as metadata_key
      where lower(metadata_key) in (
        'authorization', 'cookie', 'apikey', 'x-trello-webhook'
      )
    ) then
    raise exception 'raw evidence capture input is invalid'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from momi_communications.source_types
    where source_type = p_source_type
      and capture_contract_key = 'momi.raw_json.capture_evidence.v1'
      and active
  ) then
    raise exception 'raw evidence source type is not registered'
      using errcode = '22023';
  end if;

  computed_hash := encode(extensions.digest(
    convert_to(p_raw_text, 'UTF8'), 'sha256'
  ), 'hex');

  insert into momi_communications.source_accounts (
    source_type,
    source_account_key,
    display_label
  ) values (
    p_source_type,
    p_source_account_key,
    p_source_account_key
  )
  on conflict (source_type, source_account_key) do nothing
  returning source_account_id into account_id;

  if account_id is null then
    select source_account_id into strict account_id
    from momi_communications.source_accounts
    where source_type = p_source_type
      and source_account_key = p_source_account_key;
  end if;

  insert into momi_communications.archive_items (
    source_type,
    source_account_id,
    source_account_key,
    source_user_key,
    source_conversation_key,
    source_message_key,
    sender_role,
    occurred_at,
    source_metadata,
    payload,
    raw_text,
    content_hash,
    idempotency_key,
    capture_actor,
    tool_version
  ) values (
    p_source_type,
    account_id,
    p_source_account_key,
    p_source_user_key,
    p_source_conversation_key,
    p_source_message_key,
    p_sender_role,
    p_occurred_at,
    p_source_metadata,
    p_payload,
    p_raw_text,
    computed_hash,
    p_idempotency_key,
    p_capture_actor,
    p_tool_version
  )
  on conflict do nothing
  returning momi_communications.archive_items.archive_item_id into inserted_id;

  if inserted_id is null then
    select item.archive_item_id, item.content_hash
      into existing_id, existing_hash
    from momi_communications.archive_items as item
    where item.source_type = p_source_type
      and item.source_account_key = p_source_account_key
      and item.idempotency_key = p_idempotency_key;
    if existing_id is null or existing_hash <> computed_hash then
      raise exception 'raw evidence replay conflicts'
        using errcode = '23505';
    end if;
    disposition := 'duplicate';
    archive_item_id := existing_id;
  else
    disposition := 'stored';
    archive_item_id := inserted_id;
  end if;

  content_hash := computed_hash;
  return next;
end;
$$;

comment on function momi_communications.capture_raw_json_evidence_v1(
  text, text, text, text, text, text, timestamptz,
  jsonb, jsonb, text, text, text, text
) is 'Capture one complete immutable JSON source document with exact raw text.';

revoke all on function momi_communications.capture_raw_json_evidence_v1(
  text, text, text, text, text, text, timestamptz,
  jsonb, jsonb, text, text, text, text
) from public, anon, authenticated;

grant execute on function momi_communications.capture_raw_json_evidence_v1(
  text, text, text, text, text, text, timestamptz,
  jsonb, jsonb, text, text, text, text
) to service_role;
