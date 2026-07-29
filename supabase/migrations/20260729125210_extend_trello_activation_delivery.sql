-- service-owner: trello-task-delivery

alter table momi_trello_delivery.operations
  drop constraint operations_operation_type_check;

alter table momi_trello_delivery.operations
  alter column list_name drop not null,
  alter column list_position drop not null,
  add column card_id text,
  add column target_list_id text,
  add column webhook_callback_url text,
  add column webhook_description text,
  add column webhook_inventory_job_id uuid,
  add column webhook_inventory_completed_at timestamptz,
  add column callback_head_evidence_ref text,
  add column callback_head_verified_at timestamptz,
  add column callback_head_http_status integer,
  add constraint operations_operation_type_check check (
    operation_type in ('create_list', 'move_card', 'register_webhook')
  ),
  add constraint operations_shape_check check (
    case operation_type
      when 'create_list' then
        list_name is not null and list_position is not null
        and card_id is null and target_list_id is null
        and webhook_callback_url is null and webhook_description is null
        and webhook_inventory_job_id is null
        and webhook_inventory_completed_at is null
        and callback_head_evidence_ref is null
        and callback_head_verified_at is null
        and callback_head_http_status is null
      when 'move_card' then
        list_name is null and list_position is null
        and card_id is not null and target_list_id is not null
        and webhook_callback_url is null and webhook_description is null
        and webhook_inventory_job_id is null
        and webhook_inventory_completed_at is null
        and callback_head_evidence_ref is null
        and callback_head_verified_at is null
        and callback_head_http_status is null
      when 'register_webhook' then
        list_name is null and list_position is null
        and card_id is null and target_list_id is null
        and webhook_callback_url is not null and webhook_description is not null
        and webhook_inventory_job_id is not null
        and webhook_inventory_completed_at is not null
        and callback_head_evidence_ref is not null
        and callback_head_verified_at is not null
        and callback_head_http_status = 200
      else false
    end
  ),
  add constraint operations_webhook_precondition_fresh_check check (
    operation_type <> 'register_webhook'
    or (
      webhook_inventory_completed_at
        between enqueued_at - interval '15 minutes' and enqueued_at + interval '1 minute'
      and callback_head_verified_at
        between enqueued_at - interval '15 minutes' and enqueued_at + interval '1 minute'
    )
  );

create or replace function momi_trello_delivery.enqueue_create_list_v1(
  p_idempotency_key text,
  p_board_id text,
  p_list_name text,
  p_list_position text
)
returns table (
  disposition text,
  operation_id uuid,
  capability_token text,
  operation_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_token text;
  inserted_id uuid;
  existing_operation momi_trello_delivery.operations%rowtype;
begin
  if nullif(p_idempotency_key, '') is null
    or nullif(p_board_id, '') is null
    or nullif(p_list_name, '') is null
    or p_list_position not in ('top', 'bottom')
    or length(p_idempotency_key) > 512
    or length(p_board_id) > 256
    or length(p_list_name) > 256 then
    raise exception 'Trello list delivery is invalid' using errcode = '22023';
  end if;

  generated_token := gen_random_uuid()::text;
  insert into momi_trello_delivery.operations (
    idempotency_key,
    operation_type,
    board_id,
    list_name,
    list_position,
    capability_token_hash
  ) values (
    p_idempotency_key,
    'create_list',
    p_board_id,
    p_list_name,
    p_list_position,
    encode(extensions.digest(
      convert_to(generated_token, 'UTF8'), 'sha256'
    ), 'hex')
  )
  on conflict (idempotency_key) do nothing
  returning operations.operation_id into inserted_id;

  if inserted_id is not null then
    disposition := 'queued';
    operation_id := inserted_id;
    capability_token := generated_token;
    operation_status := 'queued';
    return next;
    return;
  end if;

  select * into strict existing_operation
  from momi_trello_delivery.operations
  where idempotency_key = p_idempotency_key;
  if existing_operation.operation_type <> 'create_list'
    or existing_operation.board_id <> p_board_id
    or existing_operation.list_name <> p_list_name
    or existing_operation.list_position <> p_list_position then
    raise exception 'Trello list delivery idempotency conflict'
      using errcode = '23505';
  end if;
  disposition := 'duplicate';
  operation_id := existing_operation.operation_id;
  capability_token := null;
  operation_status := existing_operation.status;
  return next;
end;
$$;

create or replace function momi_trello_delivery.claim_operation_v1(
  p_operation_id uuid,
  p_capability_token text
)
returns table (
  operation_id uuid,
  operation_type text,
  board_id text,
  list_name text,
  list_position text
)
language sql
security definer
set search_path = ''
as $$
  update momi_trello_delivery.operations as operation
  set status = 'claimed',
      claimed_at = pg_catalog.clock_timestamp(),
      attempt_count = operation.attempt_count + 1
  where operation.operation_id = p_operation_id
    and operation.operation_type = 'create_list'
    and operation.status = 'queued'
    and operation.capability_token_hash = encode(extensions.digest(
      convert_to(p_capability_token, 'UTF8'), 'sha256'
    ), 'hex')
  returning operation.operation_id, operation.operation_type,
    operation.board_id, operation.list_name, operation.list_position;
$$;

create function momi_trello_delivery.enqueue_move_card_v1(
  p_idempotency_key text,
  p_board_id text,
  p_card_id text,
  p_target_list_id text
)
returns table (
  disposition text,
  operation_id uuid,
  capability_token text,
  operation_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_token text;
  inserted_id uuid;
  existing_operation momi_trello_delivery.operations%rowtype;
begin
  if nullif(p_idempotency_key, '') is null
    or nullif(p_board_id, '') is null
    or nullif(p_card_id, '') is null
    or nullif(p_target_list_id, '') is null
    or length(p_idempotency_key) > 512
    or length(p_board_id) > 256
    or length(p_card_id) > 256
    or length(p_target_list_id) > 256 then
    raise exception 'Trello card move delivery is invalid' using errcode = '22023';
  end if;

  generated_token := gen_random_uuid()::text;
  insert into momi_trello_delivery.operations (
    idempotency_key, operation_type, board_id, card_id,
    target_list_id, capability_token_hash
  ) values (
    p_idempotency_key, 'move_card', p_board_id, p_card_id,
    p_target_list_id, encode(extensions.digest(
      convert_to(generated_token, 'UTF8'), 'sha256'
    ), 'hex')
  )
  on conflict (idempotency_key) do nothing
  returning operations.operation_id into inserted_id;

  if inserted_id is not null then
    disposition := 'queued';
    operation_id := inserted_id;
    capability_token := generated_token;
    operation_status := 'queued';
    return next;
    return;
  end if;

  select * into strict existing_operation
  from momi_trello_delivery.operations
  where idempotency_key = p_idempotency_key;
  if existing_operation.operation_type <> 'move_card'
    or existing_operation.board_id <> p_board_id
    or existing_operation.card_id <> p_card_id
    or existing_operation.target_list_id <> p_target_list_id then
    raise exception 'Trello card move idempotency conflict'
      using errcode = '23505';
  end if;
  disposition := 'duplicate';
  operation_id := existing_operation.operation_id;
  capability_token := null;
  operation_status := existing_operation.status;
  return next;
end;
$$;

create function momi_trello_delivery.enqueue_register_webhook_v1(
  p_idempotency_key text,
  p_board_id text,
  p_callback_url text,
  p_description text,
  p_inventory_job_id uuid,
  p_inventory_completed_at timestamptz,
  p_callback_head_evidence_ref text,
  p_callback_head_verified_at timestamptz,
  p_callback_head_http_status integer
)
returns table (
  disposition text,
  operation_id uuid,
  capability_token text,
  operation_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_token text;
  inserted_id uuid;
  existing_operation momi_trello_delivery.operations%rowtype;
begin
  if nullif(p_idempotency_key, '') is null
    or nullif(p_board_id, '') is null
    or p_callback_url !~ '^https://[^[:space:]]+$'
    or nullif(p_description, '') is null
    or p_inventory_job_id is null
    or p_inventory_completed_at is null
    or nullif(p_callback_head_evidence_ref, '') is null
    or p_callback_head_verified_at is null
    or p_callback_head_http_status <> 200
    or length(p_idempotency_key) > 512
    or length(p_board_id) > 256
    or length(p_callback_url) > 2048
    or length(p_description) > 256
    or length(p_callback_head_evidence_ref) > 512 then
    raise exception 'Trello webhook registration is invalid' using errcode = '22023';
  end if;

  generated_token := gen_random_uuid()::text;
  insert into momi_trello_delivery.operations (
    idempotency_key, operation_type, board_id, webhook_callback_url,
    webhook_description, webhook_inventory_job_id,
    webhook_inventory_completed_at, callback_head_evidence_ref,
    callback_head_verified_at, callback_head_http_status,
    capability_token_hash
  ) values (
    p_idempotency_key, 'register_webhook', p_board_id, p_callback_url,
    p_description, p_inventory_job_id, p_inventory_completed_at,
    p_callback_head_evidence_ref, p_callback_head_verified_at,
    p_callback_head_http_status, encode(extensions.digest(
      convert_to(generated_token, 'UTF8'), 'sha256'
    ), 'hex')
  )
  on conflict (idempotency_key) do nothing
  returning operations.operation_id into inserted_id;

  if inserted_id is not null then
    disposition := 'queued';
    operation_id := inserted_id;
    capability_token := generated_token;
    operation_status := 'queued';
    return next;
    return;
  end if;

  select * into strict existing_operation
  from momi_trello_delivery.operations
  where idempotency_key = p_idempotency_key;
  if existing_operation.operation_type <> 'register_webhook'
    or existing_operation.board_id <> p_board_id
    or existing_operation.webhook_callback_url <> p_callback_url
    or existing_operation.webhook_description <> p_description
    or existing_operation.webhook_inventory_job_id <> p_inventory_job_id
    or existing_operation.webhook_inventory_completed_at <> p_inventory_completed_at
    or existing_operation.callback_head_evidence_ref <> p_callback_head_evidence_ref
    or existing_operation.callback_head_verified_at <> p_callback_head_verified_at
    or existing_operation.callback_head_http_status <> p_callback_head_http_status then
    raise exception 'Trello webhook registration idempotency conflict'
      using errcode = '23505';
  end if;
  disposition := 'duplicate';
  operation_id := existing_operation.operation_id;
  capability_token := null;
  operation_status := existing_operation.status;
  return next;
end;
$$;

create function momi_trello_delivery.claim_move_card_v1(
  p_operation_id uuid,
  p_capability_token text
)
returns table (
  operation_id uuid,
  board_id text,
  card_id text,
  target_list_id text
)
language sql
security definer
set search_path = ''
as $$
  update momi_trello_delivery.operations as operation
  set status = 'claimed',
      claimed_at = pg_catalog.clock_timestamp(),
      attempt_count = operation.attempt_count + 1
  where operation.operation_id = p_operation_id
    and operation.operation_type = 'move_card'
    and operation.status = 'queued'
    and operation.capability_token_hash = encode(extensions.digest(
      convert_to(p_capability_token, 'UTF8'), 'sha256'
    ), 'hex')
  returning operation.operation_id, operation.board_id,
    operation.card_id, operation.target_list_id;
$$;

create function momi_trello_delivery.claim_register_webhook_v1(
  p_operation_id uuid,
  p_capability_token text
)
returns table (
  operation_id uuid,
  board_id text,
  callback_url text,
  description text,
  inventory_job_id uuid,
  inventory_completed_at timestamptz,
  callback_head_evidence_ref text,
  callback_head_verified_at timestamptz,
  callback_head_http_status integer
)
language sql
security definer
set search_path = ''
as $$
  update momi_trello_delivery.operations as operation
  set status = 'claimed',
      claimed_at = pg_catalog.clock_timestamp(),
      attempt_count = operation.attempt_count + 1
  where operation.operation_id = p_operation_id
    and operation.operation_type = 'register_webhook'
    and operation.status = 'queued'
    and operation.capability_token_hash = encode(extensions.digest(
      convert_to(p_capability_token, 'UTF8'), 'sha256'
    ), 'hex')
  returning operation.operation_id, operation.board_id,
    operation.webhook_callback_url, operation.webhook_description,
    operation.webhook_inventory_job_id,
    operation.webhook_inventory_completed_at,
    operation.callback_head_evidence_ref,
    operation.callback_head_verified_at,
    operation.callback_head_http_status;
$$;

create function momi_trello_delivery.finish_operation_status_v1(
  p_operation_id uuid,
  p_capability_token text,
  p_client_identifier text,
  p_operation_status text,
  p_http_status integer,
  p_response_headers jsonb,
  p_response_payload jsonb,
  p_response_raw_text text,
  p_error_code text
)
returns table (disposition text, operation_status text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(p_client_identifier, '') is null
    or length(p_client_identifier) > 1000
    or p_operation_status not in ('succeeded', 'failed', 'ambiguous')
    or p_response_headers is null
    or jsonb_typeof(p_response_headers) <> 'object'
    or (p_http_status is not null and p_response_raw_text is null)
    or (p_operation_status <> 'succeeded' and nullif(p_error_code, '') is null)
    or (p_operation_status = 'succeeded' and p_error_code is not null) then
    raise exception 'Trello delivery result is invalid' using errcode = '22023';
  end if;

  return query
  update momi_trello_delivery.operations as operation
  set status = p_operation_status,
      completed_at = pg_catalog.clock_timestamp(),
      client_identifier = p_client_identifier,
      http_status = p_http_status,
      response_headers = p_response_headers,
      response_payload = p_response_payload,
      response_raw_text = p_response_raw_text,
      response_hash = case when p_response_raw_text is null then null else
        encode(extensions.digest(
          convert_to(p_response_raw_text, 'UTF8'), 'sha256'
        ), 'hex')
      end,
      error_code = p_error_code
  where operation.operation_id = p_operation_id
    and operation.status = 'claimed'
    and operation.capability_token_hash = encode(extensions.digest(
      convert_to(p_capability_token, 'UTF8'), 'sha256'
    ), 'hex')
  returning 'recorded'::text, operation.status;
end;
$$;

revoke all on function momi_trello_delivery.enqueue_move_card_v1(
  text, text, text, text
) from public, anon, authenticated;
revoke all on function momi_trello_delivery.enqueue_register_webhook_v1(
  text, text, text, text, uuid, timestamptz, text, timestamptz, integer
) from public, anon, authenticated;
revoke all on function momi_trello_delivery.claim_move_card_v1(uuid, text)
  from public, anon, authenticated;
revoke all on function momi_trello_delivery.claim_register_webhook_v1(uuid, text)
  from public, anon, authenticated;
revoke all on function momi_trello_delivery.finish_operation_status_v1(
  uuid, text, text, text, integer, jsonb, jsonb, text, text
) from public, anon, authenticated;

grant execute on function momi_trello_delivery.enqueue_move_card_v1(
  text, text, text, text
) to service_role;
grant execute on function momi_trello_delivery.enqueue_register_webhook_v1(
  text, text, text, text, uuid, timestamptz, text, timestamptz, integer
) to service_role;
grant execute on function momi_trello_delivery.claim_move_card_v1(uuid, text)
  to service_role;
grant execute on function momi_trello_delivery.claim_register_webhook_v1(uuid, text)
  to service_role;
grant execute on function momi_trello_delivery.finish_operation_status_v1(
  uuid, text, text, text, integer, jsonb, jsonb, text, text
) to service_role;
