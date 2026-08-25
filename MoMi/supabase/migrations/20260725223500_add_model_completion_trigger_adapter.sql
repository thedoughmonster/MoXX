-- service-owner: model-execution-gateway

create table momi_model_execution.webhook_receipts (
  webhook_id text primary key check (length(webhook_id) between 1 and 240),
  event_id text not null unique check (length(event_id) between 1 and 240),
  event_type text not null check (event_type in (
    'response.completed', 'response.failed', 'response.incomplete',
    'response.cancelled'
  )),
  provider_response_id text not null check (length(provider_response_id) between 1 and 240),
  call_id uuid references momi_model_execution.calls(call_id),
  disposition text not null check (disposition in ('matched', 'ignored')),
  provider_created_at timestamptz not null,
  received_at timestamptz not null default now()
);

create table momi_model_execution.completion_work (
  work_id uuid primary key default gen_random_uuid(),
  call_id uuid not null unique references momi_model_execution.calls(call_id),
  provider_response_id text not null check (length(provider_response_id) between 1 and 240),
  event_type text not null check (event_type in (
    'response.completed', 'response.failed', 'response.incomplete',
    'response.cancelled', 'reconciliation'
  )),
  work_status text not null default 'pending' check (work_status in (
    'pending', 'claimed', 'completed', 'dead_letter'
  )),
  capability_token uuid not null default gen_random_uuid() unique,
  attempt_count integer not null default 0 check (attempt_count between 0 and 8),
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_error_code text check (last_error_code is null or length(last_error_code) <= 120),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index completion_work_due_idx
  on momi_model_execution.completion_work (next_attempt_at, work_id)
  where work_status in ('pending', 'claimed');

alter table momi_model_execution.webhook_receipts enable row level security;
alter table momi_model_execution.completion_work enable row level security;
revoke all on table momi_model_execution.webhook_receipts,
  momi_model_execution.completion_work from public, anon, authenticated;

create function momi_model_execution.accept_openai_webhook_v1(
  p_webhook_id text, p_event_id text, p_event_type text,
  p_provider_response_id text, p_provider_created_at timestamptz
) returns table (
  disposition text, work_id uuid, capability_token uuid
) language plpgsql security definer set search_path = '' as $$
declare
  selected_call momi_model_execution.calls%rowtype;
  selected_work momi_model_execution.completion_work%rowtype;
  inserted boolean;
begin
  if p_webhook_id is null or length(p_webhook_id) not between 1 and 240
    or p_event_id is null or length(p_event_id) not between 1 and 240
    or p_event_type not in ('response.completed', 'response.failed',
      'response.incomplete', 'response.cancelled')
    or p_provider_response_id is null
    or length(p_provider_response_id) not between 1 and 240
    or p_provider_created_at is null then
    raise exception 'invalid OpenAI webhook metadata' using errcode = '22023';
  end if;

  select calls.* into selected_call from momi_model_execution.calls calls
  where calls.provider_response_id = p_provider_response_id
    and calls.background
  order by calls.requested_at desc limit 1;

  insert into momi_model_execution.webhook_receipts (
    webhook_id, event_id, event_type, provider_response_id, call_id,
    disposition, provider_created_at
  ) values (
    p_webhook_id, p_event_id, p_event_type, p_provider_response_id,
    selected_call.call_id,
    case when selected_call.call_id is null then 'ignored' else 'matched' end,
    p_provider_created_at
  ) on conflict do nothing returning true into inserted;

  if not coalesce(inserted, false) then
    disposition := 'duplicate'; work_id := null; capability_token := null;
    return next; return;
  end if;
  if selected_call.call_id is null then
    disposition := 'ignored'; work_id := null; capability_token := null;
    return next; return;
  end if;

  insert into momi_model_execution.completion_work (
    call_id, provider_response_id, event_type
  ) values (
    selected_call.call_id, p_provider_response_id, p_event_type
  ) on conflict (call_id) do update set
    event_type = excluded.event_type,
    capability_token = case
      when momi_model_execution.completion_work.work_status = 'pending'
        then gen_random_uuid()
      else momi_model_execution.completion_work.capability_token end,
    next_attempt_at = case
      when momi_model_execution.completion_work.work_status = 'pending'
        then now()
      else momi_model_execution.completion_work.next_attempt_at end
  returning * into selected_work;

  if selected_work.work_status <> 'pending' then
    disposition := 'duplicate'; work_id := null; capability_token := null;
  else
    disposition := 'enqueued'; work_id := selected_work.work_id;
    capability_token := selected_work.capability_token;
  end if;
  return next;
end;
$$;

create function momi_model_execution.claim_completion_work_v1(
  p_work_id uuid, p_capability_token uuid
) returns table (
  work_id uuid, capability_token uuid, call_id uuid, caller_key text,
  provider_response_id text, event_type text, timeout_seconds integer
) language plpgsql security definer set search_path = '' as $$
declare selected_work momi_model_execution.completion_work%rowtype;
begin
  update momi_model_execution.completion_work work set
    work_status = 'claimed', attempt_count = work.attempt_count + 1,
    lease_expires_at = now() + interval '120 seconds', last_error_code = null
  where work.work_id = p_work_id and work.capability_token = p_capability_token
    and work.attempt_count < 8
    and ((work.work_status = 'pending' and work.next_attempt_at <= now())
      or (work.work_status = 'claimed' and work.lease_expires_at <= now()))
  returning work.* into selected_work;
  if not found then return; end if;
  return query select selected_work.work_id, selected_work.capability_token,
    calls.call_id, calls.caller_key, selected_work.provider_response_id,
    selected_work.event_type, profiles.timeout_seconds
  from momi_model_execution.calls calls
  join momi_model_execution.profiles profiles
    on profiles.purpose_key = calls.purpose_key
    and profiles.profile_key = calls.profile_key
  where calls.call_id = selected_work.call_id;
end;
$$;

create function momi_model_execution.complete_completion_work_v1(
  p_work_id uuid, p_capability_token uuid
) returns boolean language sql security definer set search_path = '' as $$
  update momi_model_execution.completion_work work set
    work_status = 'completed', lease_expires_at = null,
    completed_at = now(), last_error_code = null
  where work.work_id = p_work_id and work.capability_token = p_capability_token
    and work.work_status = 'claimed' returning true
$$;

create function momi_model_execution.retry_completion_work_v1(
  p_work_id uuid, p_capability_token uuid, p_error_code text
) returns boolean language sql security definer set search_path = '' as $$
  update momi_model_execution.completion_work work set
    work_status = case when work.attempt_count >= 8
      then 'dead_letter' else 'pending' end,
    next_attempt_at = now() + make_interval(secs => least(120,
      5 * (2 ^ greatest(work.attempt_count - 1, 0))::integer)),
    lease_expires_at = null, capability_token = gen_random_uuid(),
    last_error_code = left(coalesce(nullif(p_error_code, ''), 'completion_failed'), 120)
  where work.work_id = p_work_id and work.capability_token = p_capability_token
    and work.work_status = 'claimed' returning true
$$;

revoke all on function momi_model_execution.accept_openai_webhook_v1(
  text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function momi_model_execution.claim_completion_work_v1(uuid, uuid),
  momi_model_execution.complete_completion_work_v1(uuid, uuid),
  momi_model_execution.retry_completion_work_v1(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function momi_model_execution.accept_openai_webhook_v1(
  text, text, text, text, timestamptz) to service_role;
grant execute on function momi_model_execution.claim_completion_work_v1(uuid, uuid),
  momi_model_execution.complete_completion_work_v1(uuid, uuid),
  momi_model_execution.retry_completion_work_v1(uuid, uuid, text)
  to service_role;


create function momi_model_execution.wake_completion_worker()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  route_path constant text := '/functions/v1/momi-model-execution-completion-worker-v1';
  project_url text;
  gateway_key text;
begin
  if new.work_status <> 'pending' or new.next_attempt_at > now() then return new; end if;
  select decrypted_secret into project_url from vault.decrypted_secrets
    where name = 'momi_project_url';
  select decrypted_secret into gateway_key from vault.decrypted_secrets
    where name = 'momi_publishable_key';
  if project_url is null or gateway_key is null then return new; end if;
  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', gateway_key),
    body := jsonb_build_object('work_id', new.work_id::text,
      'capability_token', new.capability_token::text),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

create trigger dispatch_model_completion_worker
after update of capability_token on momi_model_execution.completion_work
for each row execute function momi_model_execution.wake_completion_worker();

create function momi_model_execution.run_completion_recovery_v1()
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  insert into momi_model_execution.completion_work (
    call_id, provider_response_id, event_type
  )
  select call_id, provider_response_id, 'reconciliation'
  from momi_model_execution.calls
  where background and status = 'pending' and provider_response_id is not null
    and requested_at <= now() - interval '20 seconds'
  on conflict (call_id) do nothing;

  update momi_model_execution.completion_work work set
    capability_token = gen_random_uuid(),
    work_status = case when work.attempt_count >= 8
      then 'dead_letter' else 'pending' end,
    next_attempt_at = now(), lease_expires_at = null,
    last_error_code = case when work.work_status = 'claimed'
      then coalesce(work.last_error_code, 'lease_expired') else work.last_error_code end
  where work.work_id in (
    select due.work_id from momi_model_execution.completion_work due
    where (due.work_status = 'pending' and due.next_attempt_at <= now())
      or (due.work_status = 'claimed' and due.lease_expires_at <= now())
    order by coalesce(due.lease_expires_at, due.next_attempt_at), due.work_id
    limit 4 for update skip locked
  ) and work.attempt_count < 8;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

select cron.schedule(
  'momi-model-completion-recovery-v1', '30 seconds',
  'select momi_model_execution.run_completion_recovery_v1()'
);

revoke all on function momi_model_execution.wake_completion_worker()
  from public, anon, authenticated;
revoke all on function momi_model_execution.run_completion_recovery_v1()
  from public, anon, authenticated;
