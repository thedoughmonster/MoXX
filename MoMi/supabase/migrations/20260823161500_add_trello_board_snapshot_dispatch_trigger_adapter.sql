-- service-owner: trello-data-acquisition

alter table trello_acquisition.board_snapshot_jobs
  add column next_attempt_at timestamptz,
  add column lease_expires_at timestamptz,
  add column wake_capability_token text;

update trello_acquisition.board_snapshot_jobs
set next_attempt_at = requested_at,
    lease_expires_at = case when status = 'claimed'
      then coalesce(claimed_at, requested_at) + interval '120 seconds'
      else null end;

alter table trello_acquisition.board_snapshot_jobs
  alter column next_attempt_at set default pg_catalog.clock_timestamp(),
  alter column next_attempt_at set not null,
  add constraint board_snapshot_jobs_lease_valid check (
    (status = 'claimed') = (lease_expires_at is not null)
  ),
  add constraint board_snapshot_jobs_attempt_limit check (attempt_count <= 3);

create or replace function trello_acquisition.enqueue_board_snapshot_v1(
  p_idempotency_key text, p_board_locator text
)
returns table (
  disposition text, job_id uuid, capability_token text, job_status text
)
language plpgsql security definer set search_path = '' as $$
declare
  generated_token text := gen_random_uuid()::text;
  inserted_id uuid;
  existing_job trello_acquisition.board_snapshot_jobs%rowtype;
begin
  if nullif(p_idempotency_key, '') is null
    or nullif(p_board_locator, '') is null
    or length(p_idempotency_key) > 512
    or length(p_board_locator) > 256 then
    raise exception 'board snapshot request is invalid' using errcode = '22023';
  end if;
  insert into trello_acquisition.board_snapshot_jobs (
    idempotency_key, board_locator, capability_token_hash,
    wake_capability_token
  ) values (
    p_idempotency_key, p_board_locator,
    encode(extensions.digest(convert_to(generated_token, 'UTF8'), 'sha256'), 'hex'),
    generated_token
  ) on conflict (idempotency_key) do nothing
  returning board_snapshot_jobs.job_id into inserted_id;
  if inserted_id is not null then
    disposition := 'queued'; job_id := inserted_id;
    capability_token := generated_token; job_status := 'queued';
    return next; return;
  end if;
  select * into strict existing_job
  from trello_acquisition.board_snapshot_jobs
  where idempotency_key = p_idempotency_key;
  if existing_job.board_locator <> p_board_locator then
    raise exception 'board snapshot idempotency conflict' using errcode = '23505';
  end if;
  disposition := 'duplicate'; job_id := existing_job.job_id;
  capability_token := null; job_status := existing_job.status;
  return next;
end;
$$;

create or replace function trello_acquisition.claim_board_snapshot_v1(
  p_job_id uuid, p_capability_token text
)
returns table (job_id uuid, board_locator text)
language sql security definer set search_path = '' as $$
  update trello_acquisition.board_snapshot_jobs as job
  set status = 'claimed', claimed_at = pg_catalog.clock_timestamp(),
      lease_expires_at = pg_catalog.clock_timestamp() + interval '120 seconds',
      attempt_count = job.attempt_count + 1, wake_capability_token = null,
      error_code = null
  where job.job_id = p_job_id and job.status = 'queued'
    and job.next_attempt_at <= pg_catalog.clock_timestamp()
    and job.attempt_count < 3
    and job.capability_token_hash = encode(extensions.digest(
      convert_to(p_capability_token, 'UTF8'), 'sha256'
    ), 'hex')
  returning job.job_id, job.board_locator;
$$;

create or replace function trello_acquisition.finish_board_snapshot_v1(
  p_job_id uuid, p_capability_token text, p_http_status integer,
  p_response_headers jsonb, p_response_payload jsonb,
  p_response_raw_text text, p_error_code text
)
returns table (disposition text, job_status text)
language plpgsql security definer set search_path = '' as $$
begin
  if p_response_headers is null or jsonb_typeof(p_response_headers) <> 'object'
    or (p_http_status is not null and p_response_raw_text is null)
    or (p_http_status is null and nullif(p_error_code, '') is null) then
    raise exception 'board snapshot result is invalid' using errcode = '22023';
  end if;
  return query update trello_acquisition.board_snapshot_jobs as job
  set status = case when p_http_status between 200 and 299
        then 'succeeded' else 'failed' end,
      completed_at = pg_catalog.clock_timestamp(), http_status = p_http_status,
      response_headers = p_response_headers, response_payload = p_response_payload,
      response_raw_text = p_response_raw_text,
      response_hash = case when p_response_raw_text is null then null else
        encode(extensions.digest(convert_to(p_response_raw_text, 'UTF8'), 'sha256'), 'hex') end,
      error_code = p_error_code, lease_expires_at = null
  where job.job_id = p_job_id and job.status = 'claimed'
    and job.lease_expires_at > pg_catalog.clock_timestamp()
    and job.capability_token_hash = encode(extensions.digest(
      convert_to(p_capability_token, 'UTF8'), 'sha256'
    ), 'hex')
  returning 'recorded'::text, job.status;
end;
$$;

create function trello_acquisition.wake_board_snapshot_dispatch()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  route_path constant text := '/functions/v1/trello-board-snapshot-v1';
  project_url text;
  gateway_key text;
begin
  if new.status <> 'queued'
    or new.next_attempt_at > pg_catalog.clock_timestamp()
    or new.wake_capability_token is null then return new; end if;
  select decrypted_secret into project_url from vault.decrypted_secrets
    where name = 'momi_project_url';
  select decrypted_secret into gateway_key from vault.decrypted_secrets
    where name = 'momi_publishable_key';
  if project_url is null or gateway_key is null then return new; end if;
  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 'apikey', gateway_key
    ),
    body := jsonb_build_object(
      'job_id', new.job_id::text,
      'capability_token', new.wake_capability_token
    ),
    timeout_milliseconds := 5000
  );
  update trello_acquisition.board_snapshot_jobs job
  set wake_capability_token = null
  where job.job_id = new.job_id
    and job.wake_capability_token = new.wake_capability_token;
  return new;
end;
$$;

create trigger wake_board_snapshot_dispatch
after insert or update of wake_capability_token
on trello_acquisition.board_snapshot_jobs
for each row execute function trello_acquisition.wake_board_snapshot_dispatch();

create function trello_acquisition.run_board_snapshot_dispatch_recovery_v1()
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  update trello_acquisition.board_snapshot_jobs job
  set status = 'failed', completed_at = pg_catalog.clock_timestamp(),
      lease_expires_at = null, error_code = 'claim_lease_attempts_exhausted'
  where job.attempt_count >= 3 and (
    (job.status = 'queued'
      and job.next_attempt_at <= pg_catalog.clock_timestamp())
    or (job.status = 'claimed'
      and job.lease_expires_at <= pg_catalog.clock_timestamp())
  );
  with due as (
    select job.job_id from trello_acquisition.board_snapshot_jobs job
    where (job.status = 'queued' and job.attempt_count < 3
        and job.next_attempt_at <= pg_catalog.clock_timestamp())
      or (job.status = 'claimed' and job.attempt_count < 3
        and job.lease_expires_at <= pg_catalog.clock_timestamp())
    order by coalesce(job.lease_expires_at, job.next_attempt_at), job.job_id
    limit 8 for update skip locked
  ), tokens as (
    select due.job_id, gen_random_uuid()::text capability_token from due
  )
  update trello_acquisition.board_snapshot_jobs job
  set status = 'queued', next_attempt_at = pg_catalog.clock_timestamp(),
      lease_expires_at = null, wake_capability_token = tokens.capability_token,
      capability_token_hash = encode(extensions.digest(
        convert_to(tokens.capability_token, 'UTF8'), 'sha256'
      ), 'hex'),
      error_code = case when job.status = 'claimed'
        then 'claim_lease_expired' else job.error_code end
  from tokens where job.job_id = tokens.job_id;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

select cron.schedule(
  'momi-trello-board-snapshot-dispatch-recovery-v1',
  '* * * * *',
  'select trello_acquisition.run_board_snapshot_dispatch_recovery_v1()'
);

revoke all on function trello_acquisition.wake_board_snapshot_dispatch(),
  trello_acquisition.run_board_snapshot_dispatch_recovery_v1()
  from public, anon, authenticated;
grant execute on function trello_acquisition.run_board_snapshot_dispatch_recovery_v1()
  to service_role;
