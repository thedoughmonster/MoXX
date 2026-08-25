-- service-owner: communications-archive
create or replace function momi_communications.capture_operational_note_v1(p_note jsonb)
returns table (disposition text, archive_item_id uuid, evaluation_job_id bigint)
language plpgsql security invoker set search_path = ''
as $$
declare
  account_key text; user_key text; surface text; conversation_key text;
  conversation_hint text; questions jsonb; actors jsonb; confidence_value numeric;
  provenance jsonb; note_payload jsonb; note_fingerprint text;
  capture_fingerprint text; note_occurred_at timestamptz;
begin
  if jsonb_typeof(p_note) <> 'object' then
    raise exception 'Operational note must be a JSON object' using errcode = '22023';
  end if;
  if (p_note - array[
    'source_account_key', 'source_user_key', 'note_type', 'summary',
    'supporting_context', 'open_questions', 'actors', 'confidence',
    'source_surface', 'source_conversation_key', 'conversation_hint',
    'occurred_at', 'idempotency_key', 'capture_actor', 'tool_version',
    'model_version', 'prompt_version'
  ]) <> '{}'::jsonb then
    raise exception 'Operational note contains unsupported fields' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(array[
      'source_account_key', 'source_user_key', 'note_type', 'summary',
      'supporting_context', 'source_surface', 'source_conversation_key',
      'conversation_hint', 'occurred_at', 'idempotency_key', 'capture_actor',
      'tool_version', 'model_version', 'prompt_version'
    ]) as fields(field_name)
    where p_note ? field_name and p_note -> field_name <> 'null'::jsonb
      and jsonb_typeof(p_note -> field_name) <> 'string'
  ) then
    raise exception 'Operational note text fields must be strings' using errcode = '22023';
  end if;
  account_key := nullif(btrim(p_note ->> 'source_account_key'), '');
  user_key := nullif(btrim(p_note ->> 'source_user_key'), '');
  if account_key is null or user_key is null
    or nullif(btrim(p_note ->> 'note_type'), '') is null
    or nullif(btrim(p_note ->> 'summary'), '') is null then
    raise exception 'Operational note account, user, type, and summary are required'
      using errcode = '22023';
  end if;
  if p_note ->> 'note_type' not in (
    'decision', 'task', 'question', 'fact', 'idea', 'risk', 'preference',
    'correction', 'outcome', 'other'
  ) then
    raise exception 'Operational note type is invalid' using errcode = '22023';
  end if;
  questions := coalesce(nullif(p_note -> 'open_questions', 'null'::jsonb), '[]'::jsonb);
  actors := coalesce(nullif(p_note -> 'actors', 'null'::jsonb), '[]'::jsonb);
  if jsonb_typeof(questions) <> 'array' or jsonb_typeof(actors) <> 'array' then
    raise exception 'Operational note questions and actors must be arrays' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(questions) item
      where jsonb_typeof(item) <> 'string')
    or exists (select 1 from jsonb_array_elements(actors) item
      where jsonb_typeof(item) <> 'string') then
    raise exception 'Operational note questions and actors must be string arrays'
      using errcode = '22023';
  end if;
  if p_note ? 'confidence' and p_note -> 'confidence' <> 'null'::jsonb
    and jsonb_typeof(p_note -> 'confidence') <> 'number' then
    raise exception 'Operational note confidence must be numeric' using errcode = '22023';
  end if;
  confidence_value := (p_note ->> 'confidence')::numeric;
  if confidence_value is not null and (confidence_value < 0 or confidence_value > 1) then
    raise exception 'Operational note confidence must be between zero and one'
      using errcode = '22023';
  end if;
  surface := coalesce(nullif(btrim(p_note ->> 'source_surface'), ''), 'chatgpt');
  conversation_hint := nullif(btrim(p_note ->> 'conversation_hint'), '');
  conversation_key := nullif(btrim(p_note ->> 'source_conversation_key'), '');
  if conversation_key is null then
    conversation_key := 'operational-note:conversation:' || substring(encode(
      extensions.digest(convert_to(concat_ws(chr(31), account_key, user_key,
        surface, coalesce(conversation_hint, '')), 'UTF8'), 'sha256'), 'hex'), 1, 32);
  end if;
  provenance := jsonb_strip_nulls(jsonb_build_object(
    'provider', 'openai', 'surface', surface,
    'source_conversation_key', conversation_key,
    'conversation_hint', conversation_hint,
    'synthesis_scope', 'conversation_context', 'raw_turns_included', false
  ));
  note_payload := jsonb_strip_nulls(jsonb_build_object(
    'schema_version', 1, 'record_kind', 'candidate_operational_memory',
    'note_type', p_note ->> 'note_type', 'summary', p_note ->> 'summary',
    'supporting_context', nullif(p_note ->> 'supporting_context', ''),
    'open_questions', questions, 'actors', actors,
    'confidence', confidence_value, 'provenance', provenance
  ));
  note_fingerprint := encode(extensions.digest(convert_to(concat_ws(chr(31),
    account_key, user_key, conversation_key, note_payload::text), 'UTF8'), 'sha256'), 'hex');
  capture_fingerprint := encode(extensions.digest(convert_to(concat_ws(chr(31),
    account_key, user_key, coalesce(nullif(p_note ->> 'idempotency_key', ''),
    note_fingerprint)), 'UTF8'), 'sha256'), 'hex');
  note_occurred_at := nullif(p_note ->> 'occurred_at', '')::timestamptz;
  if note_occurred_at is null then
    select item.occurred_at into note_occurred_at
    from momi_communications.archive_items as item
    where item.source_type = 'openai' and item.source_account_key = account_key
      and item.source_user_key = user_key
      and item.idempotency_key = 'operational-note:v1:' || capture_fingerprint;
  end if;
  note_occurred_at := coalesce(note_occurred_at, now());
  return query select captured.disposition, captured.archive_item_id,
    captured.evaluation_job_id
  from momi_communications.capture_openai_message_v1(
    account_key, user_key, conversation_key,
    'operational-note:' || capture_fingerprint, 'assistant', note_occurred_at,
    note_payload, 'operational-note:v1:' || capture_fingerprint, now(),
    provenance, p_note ->> 'summary', null,
    coalesce(nullif(p_note ->> 'capture_actor', ''), 'chatgpt_account_instructions'),
    p_note ->> 'tool_version', p_note ->> 'model_version',
    coalesce(nullif(p_note ->> 'prompt_version', ''), 'momi-operational-memory-v1')
  ) as captured;
end;
$$;
