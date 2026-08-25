-- service-owner: communications-archive
create or replace function momi_communications.capture_openai_message_v1(
  p_source_account_key text, p_source_user_key text,
  p_source_conversation_key text, p_source_message_key text,
  p_sender_role text, p_occurred_at timestamptz, p_payload jsonb,
  p_idempotency_key text, p_captured_at timestamptz default now(),
  p_source_metadata jsonb default '{}'::jsonb, p_raw_text text default null,
  p_source_parent_message_key text default null, p_capture_actor text default null,
  p_tool_version text default null, p_model_version text default null,
  p_prompt_version text default null
)
returns table (disposition text, archive_item_id uuid, evaluation_job_id bigint)
language plpgsql security invoker set search_path = ''
as $$
declare
  account_id uuid;
  idempotency_item_id uuid;
  source_item_id uuid;
  existing_hash text;
  item_id uuid;
  job_id bigint;
  payload_hash text;
begin
  if p_source_account_key is null or p_source_account_key = ''
    or p_source_user_key is null or p_source_user_key = ''
    or p_source_conversation_key is null or p_source_conversation_key = ''
    or p_source_message_key is null or p_source_message_key = ''
    or p_sender_role is null or p_sender_role = ''
    or p_idempotency_key is null or p_idempotency_key = '' then
    raise exception 'OpenAI communication source identity is required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload) not in ('object', 'array')
    or jsonb_typeof(p_source_metadata) <> 'object' then
    raise exception 'OpenAI communication payload metadata is invalid' using errcode = '22023';
  end if;
  payload_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    p_sender_role, p_occurred_at, p_source_parent_message_key,
    p_source_metadata, p_payload, p_raw_text
  )::text, 'UTF8'), 'sha256'), 'hex');
  insert into momi_communications.source_accounts (source_type, source_account_key)
  values ('openai', p_source_account_key)
  on conflict (source_type, source_account_key) do nothing
  returning source_account_id into account_id;
  if account_id is null then
    select source_account.source_account_id into account_id
    from momi_communications.source_accounts as source_account
    where source_account.source_type = 'openai'
      and source_account.source_account_key = p_source_account_key;
  end if;
  insert into momi_communications.archive_items (
    source_type, source_account_id, source_account_key, source_user_key,
    source_conversation_key, source_message_key, source_parent_message_key,
    sender_role, occurred_at, captured_at, source_metadata, payload, raw_text,
    content_hash, idempotency_key, capture_actor, tool_version, model_version,
    prompt_version
  ) values (
    'openai', account_id, p_source_account_key, p_source_user_key,
    p_source_conversation_key, p_source_message_key, p_source_parent_message_key,
    p_sender_role, p_occurred_at, coalesce(p_captured_at, now()),
    p_source_metadata, p_payload, p_raw_text, payload_hash, p_idempotency_key,
    p_capture_actor, p_tool_version, p_model_version, p_prompt_version
  ) on conflict do nothing
  returning momi_communications.archive_items.archive_item_id into item_id;
  if item_id is null then
    select item.archive_item_id into idempotency_item_id
    from momi_communications.archive_items as item
    where item.source_type = 'openai'
      and item.source_account_key = p_source_account_key
      and item.source_user_key = p_source_user_key
      and item.idempotency_key = p_idempotency_key;
    select item.archive_item_id into source_item_id
    from momi_communications.archive_items as item
    where item.source_type = 'openai'
      and item.source_account_key = p_source_account_key
      and item.source_user_key = p_source_user_key
      and item.source_conversation_key = p_source_conversation_key
      and item.source_message_key = p_source_message_key;
    item_id := coalesce(idempotency_item_id, source_item_id);
    if item_id is null or (
      idempotency_item_id is not null and source_item_id is not null
      and idempotency_item_id <> source_item_id
    ) then
      raise exception 'OpenAI communication replay conflicts with archive' using errcode = '23505';
    end if;
    select item.content_hash into existing_hash
    from momi_communications.archive_items as item
    where item.archive_item_id = item_id;
    if existing_hash <> payload_hash then
      raise exception 'OpenAI communication replay conflicts with archive' using errcode = '23505';
    end if;
    disposition := 'duplicate';
  else
    disposition := 'stored';
  end if;
  insert into momi_communications.evaluation_jobs (archive_item_id)
  values (item_id)
  on conflict on constraint evaluation_jobs_archive_unique do nothing
  returning momi_communications.evaluation_jobs.evaluation_job_id into job_id;
  if job_id is null then
    select job.evaluation_job_id into job_id
    from momi_communications.evaluation_jobs as job
    where job.archive_item_id = item_id;
  end if;
  insert into momi_communications.audit_events (
    archive_item_id, actor_key, action_key, idempotency_key,
    source_account_id, model_version, tool_version, prompt_version
  ) values (
    item_id, coalesce(p_capture_actor, 'unknown_capture_actor'),
    'capture_openai_message_v1', p_idempotency_key, account_id,
    p_model_version, p_tool_version, p_prompt_version
  );
  archive_item_id := item_id; evaluation_job_id := job_id;
  return next;
end;
$$;
