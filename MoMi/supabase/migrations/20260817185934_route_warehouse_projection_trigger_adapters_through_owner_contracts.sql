-- service-owner: warehouse-projection

create or replace function warehouse_projection.claim_database_delivery()
returns table (event_id uuid, message_id bigint, capability_token uuid)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from warehouse_projection.worker_settings
    where subscription_key = 'warehouse-projection-toast-v1'
      and processor_mode = 'database'
  ) then return; end if;
  return query
  select claimed.event_id, claimed.message_id, claimed.capability_token
  from momi_events.claim_warehouse_projection_delivery_v1() as claimed;
end;
$$;

create or replace function warehouse_projection.begin_reserved_delivery(
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select momi_events.begin_reserved_warehouse_projection_delivery_v1(
    p_event_id, p_message_id, p_capability_token
  );
$$;

create or replace procedure warehouse_projection.process_delivery_batch(
  p_limit integer default 6,
  p_budget_seconds integer default 60
)
language plpgsql
security invoker
as $$
declare
  claimed record;
  failure_state text;
  failure_text text;
  processed integer := 0;
  started_at timestamptz := clock_timestamp();
begin
  if p_limit < 1 or p_limit > 32
    or p_budget_seconds < 5 or p_budget_seconds > 90
  then raise exception 'projection_batch_envelope_invalid'; end if;
  loop
    exit when processed >= p_limit
      or clock_timestamp() >= started_at
        + make_interval(secs => p_budget_seconds);
    select * into claimed from
      warehouse_projection.claim_database_delivery();
    exit when not found;
    commit and chain;
    failure_text := null;
    begin
      perform warehouse_projection.project_and_ack_delivery(
        claimed.event_id, claimed.message_id, claimed.capability_token
      );
    exception when others then
      get stacked diagnostics failure_state = returned_sqlstate,
        failure_text = message_text;
    end;
    if failure_text is not null then
      perform momi_events.fail_delivery(
        'warehouse-projection-toast-v1', claimed.event_id,
        claimed.message_id, claimed.capability_token,
        failure_state || ': ' || failure_text
      );
    end if;
    processed := processed + 1;
    commit and chain;
  end loop;
end;
$$;

create or replace function warehouse_projection.project_and_ack_delivery(
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  acknowledged boolean;
  projection_result text;
begin
  perform 1
  from momi_events.acquire_warehouse_projection_delivery_witness_v1(
    p_event_id, p_message_id, p_capability_token, 0
  );
  if not found then raise exception 'delivery_not_claimed'; end if;
  perform 1
  from momi_events.read_warehouse_projection_delivery_reference_v1(
    p_event_id, p_message_id, p_capability_token
  );
  if not found then raise exception 'source_event_mismatch'; end if;
  projection_result := warehouse_projection.project_toast_event(p_event_id);
  if not (
    projection_result in (
      'acquisition_enqueued', 'acquisition_already_enqueued',
      'menu_refresh_enqueued', 'publication_not_advanced'
    )
    or projection_result ~ '^projected(_[a-z0-9_]+)?$'
    or projection_result ~ '^ignored_[a-z0-9_]+$'
  ) then raise exception 'unexpected_projection_outcome'; end if;
  select momi_events.ack_delivery(
    'warehouse-projection-toast-v1', p_event_id,
    p_message_id, p_capability_token
  ) into acknowledged;
  if not coalesce(acknowledged, false) then
    raise exception 'acknowledgement_failed';
  end if;
  return projection_result;
end;
$$;

create or replace function warehouse_projection.reserve_internal_delivery()
returns table (
  event_id uuid,
  message_id bigint,
  capability_token uuid
)
language sql
security invoker
set search_path = ''
as $$
  select reserved.event_id, reserved.message_id, reserved.capability_token
  from warehouse_projection.worker_settings as settings
  cross join lateral momi_events.reserve_warehouse_projection_delivery_v1(
    'internal', settings.max_parallel_deliveries, 30
  ) as reserved
  where settings.subscription_key = 'warehouse-projection-toast-v1'
    and settings.processor_mode = 'edge';
$$;

create or replace function warehouse_projection.wake_next_delivery()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parallel_limit integer;
  reserved record;
  woken integer := 0;
begin
  select settings.max_parallel_deliveries into parallel_limit
  from warehouse_projection.worker_settings as settings
  where settings.subscription_key = 'warehouse-projection-toast-v1'
    and settings.processor_mode = 'edge';
  if parallel_limit is null then return false; end if;
  loop
    select * into reserved
    from momi_events.reserve_warehouse_projection_delivery_v1(
      'http', parallel_limit, 30
    );
    exit when not found;
    woken := woken + 1;
  end loop;
  return woken > 0;
end;
$$;

create or replace function warehouse_projection.wake_projection_worker()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  route_path text;
  project_url text;
  gateway_key text;
begin
  if tg_op = 'INSERT' then return new; end if;
  if old.status is distinct from new.status
    or old.queue_message_id is distinct from new.queue_message_id
  then return new; end if;
  select resolved.route_path into route_path
  from momi_runtime.resolve_warehouse_projection_trigger_v1() as resolved;
  select decrypted_secret into project_url from vault.decrypted_secrets
  where name = 'momi_project_url';
  select decrypted_secret into gateway_key from vault.decrypted_secrets
  where name = 'momi_publishable_key';
  if route_path is null or project_url is null or gateway_key is null then
    return new;
  end if;
  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 'apikey', gateway_key
    ),
    body := jsonb_build_object(
      'event_id', new.event_id,
      'message_id', new.queue_message_id::text,
      'capability_token', new.capability_token::text
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;
