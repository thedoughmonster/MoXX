-- service-owner: trello-data-acquisition

create table trello_acquisition.webhook_inventory_jobs (
  job_id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  board_id text not null,
  status text not null default 'queued'
    check (status in ('queued', 'claimed', 'succeeded', 'failed')),
  capability_token_hash text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  requested_at timestamptz not null default pg_catalog.clock_timestamp(),
  claimed_at timestamptz,
  completed_at timestamptz,
  http_status integer check (http_status between 100 and 599),
  response_headers jsonb,
  response_payload jsonb,
  response_raw_text text,
  response_hash text,
  error_code text
);

comment on table trello_acquisition.webhook_inventory_jobs is
  'Durable complete Trello token webhook inventory acquisition attempts.';

create function trello_acquisition.enqueue_webhook_inventory_v1(
  p_idempotency_key text,
  p_board_id text
)
returns table (
  disposition text,
  job_id uuid,
  capability_token text,
  job_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_token text;
  inserted_id uuid;
  existing_job trello_acquisition.webhook_inventory_jobs%rowtype;
begin
  if nullif(p_idempotency_key, '') is null
    or nullif(p_board_id, '') is null
    or length(p_idempotency_key) > 512
    or length(p_board_id) > 256 then
    raise exception 'webhook inventory request is invalid' using errcode = '22023';
  end if;

  generated_token := gen_random_uuid()::text;
  insert into trello_acquisition.webhook_inventory_jobs (
    idempotency_key,
    board_id,
    capability_token_hash
  ) values (
    p_idempotency_key,
    p_board_id,
    encode(extensions.digest(
      convert_to(generated_token, 'UTF8'), 'sha256'
    ), 'hex')
  )
  on conflict (idempotency_key) do nothing
  returning webhook_inventory_jobs.job_id into inserted_id;

  if inserted_id is not null then
    disposition := 'queued';
    job_id := inserted_id;
    capability_token := generated_token;
    job_status := 'queued';
    return next;
    return;
  end if;

  select * into strict existing_job
  from trello_acquisition.webhook_inventory_jobs
  where idempotency_key = p_idempotency_key;
  if existing_job.board_id <> p_board_id then
    raise exception 'webhook inventory idempotency conflict' using errcode = '23505';
  end if;
  disposition := 'duplicate';
  job_id := existing_job.job_id;
  capability_token := null;
  job_status := existing_job.status;
  return next;
end;
$$;

create function trello_acquisition.claim_webhook_inventory_v1(
  p_job_id uuid,
  p_capability_token text
)
returns table (job_id uuid, board_id text)
language sql
security definer
set search_path = ''
as $$
  update trello_acquisition.webhook_inventory_jobs as job
  set status = 'claimed',
      claimed_at = pg_catalog.clock_timestamp(),
      attempt_count = job.attempt_count + 1
  where job.job_id = p_job_id
    and job.status = 'queued'
    and job.capability_token_hash = encode(extensions.digest(
      convert_to(p_capability_token, 'UTF8'), 'sha256'
    ), 'hex')
  returning job.job_id, job.board_id;
$$;

create function trello_acquisition.finish_webhook_inventory_v1(
  p_job_id uuid,
  p_capability_token text,
  p_http_status integer,
  p_response_headers jsonb,
  p_response_payload jsonb,
  p_response_raw_text text,
  p_error_code text
)
returns table (disposition text, job_status text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_response_headers is null
    or jsonb_typeof(p_response_headers) <> 'object'
    or (p_http_status is not null and p_response_raw_text is null)
    or (p_http_status is null and nullif(p_error_code, '') is null) then
    raise exception 'webhook inventory result is invalid' using errcode = '22023';
  end if;

  return query
  update trello_acquisition.webhook_inventory_jobs as job
  set status = case
        when p_http_status between 200 and 299 then 'succeeded'
        else 'failed'
      end,
      completed_at = pg_catalog.clock_timestamp(),
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
  where job.job_id = p_job_id
    and job.status = 'claimed'
    and job.capability_token_hash = encode(extensions.digest(
      convert_to(p_capability_token, 'UTF8'), 'sha256'
    ), 'hex')
  returning 'recorded'::text, job.status;
end;
$$;

revoke all on table trello_acquisition.webhook_inventory_jobs
  from public, anon, authenticated;
revoke all on function trello_acquisition.enqueue_webhook_inventory_v1(text, text)
  from public, anon, authenticated;
revoke all on function trello_acquisition.claim_webhook_inventory_v1(uuid, text)
  from public, anon, authenticated;
revoke all on function trello_acquisition.finish_webhook_inventory_v1(
  uuid, text, integer, jsonb, jsonb, text, text
) from public, anon, authenticated;

grant execute on function trello_acquisition.enqueue_webhook_inventory_v1(text, text)
  to service_role;
grant execute on function trello_acquisition.claim_webhook_inventory_v1(uuid, text)
  to service_role;
grant execute on function trello_acquisition.finish_webhook_inventory_v1(
  uuid, text, integer, jsonb, jsonb, text, text
) to service_role;
