-- service-owner: momi-event-routing

create table momi_events.warehouse_delivery_reservations (
  event_id uuid not null,
  subscription_key text not null default 'warehouse-projection-toast-v1',
  queue_message_id bigint not null,
  capability_token uuid not null,
  reserved_until timestamptz not null,
  dispatch_mode text not null,
  primary key (event_id, subscription_key),
  unique (subscription_key, queue_message_id),
  constraint warehouse_delivery_reservation_subscription check (
    subscription_key = 'warehouse-projection-toast-v1'
  ),
  constraint warehouse_delivery_reservation_mode check (
    dispatch_mode in ('http', 'internal')
  )
);

comment on table momi_events.warehouse_delivery_reservations is
  'Event-owner state for bounded warehouse projection delivery reservations.';

alter table momi_events.warehouse_delivery_reservations enable row level security;
revoke all on table momi_events.warehouse_delivery_reservations
  from public, anon, authenticated, service_role;

create or replace function momi_events.begin_delivery(
  p_subscription_key text,
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_begun boolean := false;
begin
  update momi_events.deliveries
  set status = 'running', attempt_count = attempt_count + 1,
      lease_expires_at = pg_catalog.now() + interval '120 seconds'
  where subscription_key = p_subscription_key
    and event_id = p_event_id
    and queue_message_id = p_message_id
    and capability_token = p_capability_token
    and attempt_count < 12
    and (status = 'queued'
      or (status = 'running' and lease_expires_at <= pg_catalog.now()))
  returning true into v_begun;
  if not coalesce(v_begun, false) then return false; end if;
  delete from momi_events.warehouse_delivery_reservations
  where subscription_key = p_subscription_key
    and event_id = p_event_id
    and queue_message_id = p_message_id
    and capability_token = p_capability_token;
  return true;
end;
$$;

create or replace function momi_events.ack_delivery(
  p_subscription_key text,
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_queue_name text;
  v_message_deleted boolean;
begin
  select subscription.queue_name into v_queue_name
  from momi_events.deliveries as delivery
  join momi_events.subscriptions as subscription
    on subscription.subscription_key = delivery.subscription_key
  where delivery.subscription_key = p_subscription_key
    and delivery.event_id = p_event_id
    and delivery.queue_message_id = p_message_id
    and delivery.capability_token = p_capability_token
    and delivery.status = 'running'
    and delivery.lease_expires_at > pg_catalog.now()
  for update of delivery;
  if not found then return false; end if;
  select pgmq.delete(v_queue_name, p_message_id) into v_message_deleted;
  if not coalesce(v_message_deleted, false) then return false; end if;
  update momi_events.deliveries
  set status = 'delivered', delivered_at = pg_catalog.now(),
      queue_message_id = null, lease_expires_at = null
  where subscription_key = p_subscription_key
    and event_id = p_event_id
    and queue_message_id = p_message_id
    and capability_token = p_capability_token
    and status = 'running';
  return found;
end;
$$;

create function momi_events.begin_reserved_warehouse_projection_delivery_v1(
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_begun boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(19482, 2);
  perform 1
  from momi_events.warehouse_delivery_reservations as reservation
  where reservation.event_id = p_event_id
    and reservation.subscription_key = 'warehouse-projection-toast-v1'
    and reservation.queue_message_id = p_message_id
    and reservation.capability_token = p_capability_token
    and reservation.dispatch_mode in ('http', 'internal')
    and reservation.reserved_until > pg_catalog.now()
  for update;
  if not found then return false; end if;
  select momi_events.begin_delivery(
    'warehouse-projection-toast-v1', p_event_id,
    p_message_id, p_capability_token
  ) into v_begun;
  return coalesce(v_begun, false);
end;
$$;

create or replace function momi_events.fail_delivery(
  p_subscription_key text,
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid,
  p_error text
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_target momi_events.subscriptions;
  v_source_event momi_events.events;
  v_attempts integer;
begin
  select * into strict v_target from momi_events.subscriptions
  where subscription_key = p_subscription_key;
  select delivery.attempt_count into v_attempts
  from momi_events.deliveries as delivery
  where delivery.subscription_key = p_subscription_key
    and delivery.event_id = p_event_id
    and delivery.queue_message_id = p_message_id
    and delivery.capability_token = p_capability_token
    and delivery.status = 'running'
    and delivery.lease_expires_at > pg_catalog.now()
  for update;
  if not found then return 'not_found'; end if;
  perform pgmq.delete(v_target.queue_name, p_message_id);
  if v_attempts >= 12 then
    select * into strict v_source_event from momi_events.events
    where event_id = p_event_id;
    perform pgmq.send(
      v_target.dead_letter_queue_name,
      momi_events.event_message(v_source_event),
      0
    );
    update momi_events.deliveries
    set status = 'dead_letter', attempt_count = v_attempts,
        queue_message_id = null, lease_expires_at = null,
        dead_lettered_at = pg_catalog.now(),
        last_error = pg_catalog.left(p_error, 4000)
    where subscription_key = p_subscription_key and event_id = p_event_id;
    return 'dead_letter';
  end if;
  update momi_events.deliveries
  set status = 'retry_wait', attempt_count = v_attempts,
      queue_message_id = null, lease_expires_at = null,
      next_attempt_at = pg_catalog.now() + pg_catalog.make_interval(
        secs => least(3600, 15 * pg_catalog.power(2, v_attempts - 1)::integer)
      ),
      last_error = pg_catalog.left(p_error, 4000)
  where subscription_key = p_subscription_key and event_id = p_event_id;
  return 'retry_wait';
end;
$$;

create function momi_events.read_order_alert_delivery_reference_v1(
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid
)
returns table (
  event_id uuid,
  event_name text,
  entity_type text,
  entity_id uuid,
  occurred_at timestamptz,
  schema_version integer,
  source_system text,
  source_resource_type text,
  source_id text,
  source_reference jsonb,
  correlation_id uuid
)
language sql stable security definer set search_path = ''
as $$
  select event.event_id, event.event_name, event.entity_type,
    event.entity_id, event.occurred_at, event.schema_version,
    event.source_system, event.source_resource_type, event.source_id,
    event.source_reference, event.correlation_id
  from momi_events.deliveries as delivery
  join momi_events.events as event on event.event_id = delivery.event_id
  where delivery.subscription_key = 'order-alerting-v1'
    and delivery.event_id = p_event_id
    and delivery.queue_message_id = p_message_id
    and delivery.capability_token = p_capability_token
    and delivery.status = 'running'
    and delivery.lease_expires_at > pg_catalog.now()
    and event.event_name = 'warehouse.order.observed';
$$;

create function momi_events.read_warehouse_projection_delivery_reference_v1(
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid
)
returns table (
  event_id uuid,
  event_name text,
  entity_type text,
  entity_id uuid,
  occurred_at timestamptz,
  schema_version integer,
  source_system text,
  source_resource_type text,
  source_id text,
  source_reference jsonb,
  correlation_id uuid
)
language sql stable security definer set search_path = ''
as $$
  select event.event_id, event.event_name, event.entity_type,
    event.entity_id, event.occurred_at, event.schema_version,
    event.source_system, event.source_resource_type, event.source_id,
    event.source_reference, event.correlation_id
  from momi_events.deliveries as delivery
  join momi_events.events as event on event.event_id = delivery.event_id
  where delivery.subscription_key = 'warehouse-projection-toast-v1'
    and delivery.event_id = p_event_id
    and delivery.queue_message_id = p_message_id
    and delivery.capability_token = p_capability_token
    and delivery.status = 'running'
    and delivery.lease_expires_at > pg_catalog.now()
    and event.source_system = 'toast'
    and event.event_name like 'source.toast.%';
$$;

create function momi_events.acquire_order_alert_delivery_witness_v1(
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid,
  p_minimum_remaining_seconds integer
)
returns table (lease_expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if p_minimum_remaining_seconds is null
    or p_minimum_remaining_seconds not between 0 and 120 then
    raise exception 'delivery witness duration is invalid' using errcode = '22023';
  end if;
  return query
  select delivery.lease_expires_at
  from momi_events.deliveries as delivery
  where delivery.subscription_key = 'order-alerting-v1'
    and delivery.event_id = p_event_id
    and delivery.queue_message_id = p_message_id
    and delivery.capability_token = p_capability_token
    and delivery.status = 'running'
    and delivery.lease_expires_at >= pg_catalog.now()
      + pg_catalog.make_interval(secs => p_minimum_remaining_seconds)
  for update of delivery;
end;
$$;

create function momi_events.acquire_warehouse_projection_delivery_witness_v1(
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid,
  p_minimum_remaining_seconds integer
)
returns table (lease_expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if p_minimum_remaining_seconds is null
    or p_minimum_remaining_seconds not between 0 and 120 then
    raise exception 'delivery witness duration is invalid' using errcode = '22023';
  end if;
  return query
  select delivery.lease_expires_at
  from momi_events.deliveries as delivery
  where delivery.subscription_key = 'warehouse-projection-toast-v1'
    and delivery.event_id = p_event_id
    and delivery.queue_message_id = p_message_id
    and delivery.capability_token = p_capability_token
    and delivery.status = 'running'
    and delivery.lease_expires_at >= pg_catalog.now()
      + pg_catalog.make_interval(secs => p_minimum_remaining_seconds)
  for update of delivery;
end;
$$;

create function momi_events.authorize_order_alert_delivery_wake_v1(
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from momi_events.deliveries as delivery
    join momi_events.subscriptions as subscription
      on subscription.subscription_key = delivery.subscription_key
    where delivery.subscription_key = 'order-alerting-v1'
      and delivery.event_id = p_event_id
      and delivery.queue_message_id = p_message_id
      and delivery.capability_token = p_capability_token
      and delivery.status = 'queued'
      and subscription.consumer_service = 'order-alerting'
      and subscription.event_pattern = 'warehouse.order.observed'
      and subscription.active
  );
$$;

create function momi_events.claim_warehouse_projection_delivery_v1()
returns table (
  event_id uuid,
  message_id bigint,
  capability_token uuid,
  lease_expires_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_target record;
  v_begun boolean;
begin
  select delivery.event_id, delivery.queue_message_id,
    delivery.capability_token into v_target
  from momi_events.deliveries as delivery
  where delivery.subscription_key = 'warehouse-projection-toast-v1'
    and delivery.status = 'queued'
    and delivery.next_attempt_at <= pg_catalog.now()
    and delivery.attempt_count < 12
    and delivery.queue_message_id is not null
    and delivery.capability_token is not null
    and not exists (
      select 1 from momi_events.warehouse_delivery_reservations as reservation
      where reservation.event_id = delivery.event_id
        and reservation.subscription_key = delivery.subscription_key
        and reservation.reserved_until > pg_catalog.now()
    )
  order by delivery.next_attempt_at, delivery.event_id
  limit 1 for update skip locked;
  if not found then return; end if;
  select momi_events.begin_delivery(
    'warehouse-projection-toast-v1', v_target.event_id,
    v_target.queue_message_id, v_target.capability_token
  ) into v_begun;
  if not coalesce(v_begun, false) then return; end if;
  return query
  select delivery.event_id, delivery.queue_message_id,
    delivery.capability_token, delivery.lease_expires_at
  from momi_events.deliveries as delivery
  where delivery.subscription_key = 'warehouse-projection-toast-v1'
    and delivery.event_id = v_target.event_id
    and delivery.queue_message_id = v_target.queue_message_id
    and delivery.capability_token = v_target.capability_token
    and delivery.status = 'running';
end;
$$;

create function momi_events.reserve_warehouse_projection_delivery_v1(
  p_dispatch_mode text,
  p_max_inflight integer,
  p_reservation_seconds integer
)
returns table (
  event_id uuid,
  message_id bigint,
  capability_token uuid,
  reserved_until timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_target record;
  v_token uuid;
  v_reserved_until timestamptz;
begin
  if p_dispatch_mode is null
    or p_dispatch_mode not in ('http', 'internal')
    or p_max_inflight is null or p_max_inflight not between 1 and 32
    or p_reservation_seconds is null
    or p_reservation_seconds not between 5 and 120
  then
    raise exception 'warehouse delivery reservation input is invalid'
      using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(19482, 2);
  delete from momi_events.warehouse_delivery_reservations as reservation
  where reservation.reserved_until <= pg_catalog.now()
    or not exists (
      select 1 from momi_events.deliveries as delivery
      where delivery.event_id = reservation.event_id
        and delivery.subscription_key = reservation.subscription_key
        and delivery.status = 'queued'
        and delivery.queue_message_id = reservation.queue_message_id
        and delivery.capability_token = reservation.capability_token
    );
  if (
    select pg_catalog.count(*) from momi_events.deliveries as delivery
    where delivery.subscription_key = 'warehouse-projection-toast-v1'
      and delivery.status = 'running'
      and delivery.lease_expires_at > pg_catalog.now()
  ) + (
    select pg_catalog.count(*)
    from momi_events.warehouse_delivery_reservations as reservation
    where reservation.reserved_until > pg_catalog.now()
  ) >= p_max_inflight then return; end if;
  select delivery.event_id, delivery.queue_message_id,
    delivery.capability_token into v_target
  from momi_events.deliveries as delivery
  where delivery.subscription_key = 'warehouse-projection-toast-v1'
    and delivery.status = 'queued'
    and delivery.next_attempt_at <= pg_catalog.now()
    and delivery.attempt_count < 12
    and delivery.queue_message_id is not null
    and not exists (
      select 1 from momi_events.warehouse_delivery_reservations as reservation
      where reservation.event_id = delivery.event_id
        and reservation.subscription_key = delivery.subscription_key
    )
  order by delivery.next_attempt_at, delivery.event_id
  limit 1 for update skip locked;
  if not found then return; end if;
  v_token := case when p_dispatch_mode = 'http'
    then pg_catalog.gen_random_uuid()
    else v_target.capability_token
  end;
  v_reserved_until := pg_catalog.now()
    + pg_catalog.make_interval(secs => p_reservation_seconds);
  insert into momi_events.warehouse_delivery_reservations (
    event_id, subscription_key, queue_message_id,
    capability_token, reserved_until, dispatch_mode
  ) values (
    v_target.event_id, 'warehouse-projection-toast-v1',
    v_target.queue_message_id, v_token, v_reserved_until, p_dispatch_mode
  );
  if p_dispatch_mode = 'http' then
    update momi_events.deliveries as delivery
    set capability_token = v_token
    where delivery.event_id = v_target.event_id
      and delivery.subscription_key = 'warehouse-projection-toast-v1'
      and delivery.status = 'queued'
      and delivery.queue_message_id = v_target.queue_message_id
      and delivery.capability_token = v_target.capability_token;
  else
    perform 1 from momi_events.deliveries as delivery
    where delivery.event_id = v_target.event_id
      and delivery.subscription_key = 'warehouse-projection-toast-v1'
      and delivery.status = 'queued'
      and delivery.queue_message_id = v_target.queue_message_id
      and delivery.capability_token = v_target.capability_token;
  end if;
  if not found then
    delete from momi_events.warehouse_delivery_reservations
    where event_id = v_target.event_id
      and subscription_key = 'warehouse-projection-toast-v1'
      and queue_message_id = v_target.queue_message_id
      and capability_token = v_token;
    return;
  end if;
  return query
  select v_target.event_id, v_target.queue_message_id,
    v_token, v_reserved_until;
end;
$$;

create function momi_events.append_warehouse_event_v1(
  p_event_name text,
  p_schema_version integer,
  p_idempotency_key text,
  p_entity_type text,
  p_entity_id uuid,
  p_occurred_at timestamptz,
  p_source_system text,
  p_source_resource_type text,
  p_source_id text,
  p_source_reference jsonb,
  p_correlation_id uuid
)
returns table (disposition text, event_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_inserted_id uuid;
  v_existing momi_events.events%rowtype;
  v_entity_version_replay boolean;
begin
  if nullif(p_event_name, '') is null or pg_catalog.length(p_event_name) > 160
    or p_event_name !~ '^warehouse\.[a-z0-9_.]+$'
    or p_schema_version is null or p_schema_version not in (1, 2)
    or nullif(p_idempotency_key, '') is null
    or pg_catalog.length(p_idempotency_key) > 512
    or nullif(p_entity_type, '') is null
    or pg_catalog.length(p_entity_type) > 160
    or p_entity_id is null or p_occurred_at is null
    or nullif(p_source_system, '') is null
    or pg_catalog.length(p_source_system) > 80
    or nullif(p_source_resource_type, '') is null
    or pg_catalog.length(p_source_resource_type) > 160
    or nullif(p_source_id, '') is null
    or pg_catalog.length(p_source_id) > 256
    or p_correlation_id is null or p_source_reference is null
    or pg_catalog.jsonb_typeof(p_source_reference) <> 'object'
    or pg_catalog.pg_column_size(p_source_reference) > 16384
    or exists (
      select 1 from pg_catalog.jsonb_each(p_source_reference) as item
      where pg_catalog.length(item.key) > 80
        or pg_catalog.jsonb_typeof(item.value)
          not in ('string', 'number', 'boolean', 'null')
        or (pg_catalog.jsonb_typeof(item.value) = 'string'
          and pg_catalog.length(item.value #>> '{}') > 512)
    ) then
    raise exception 'warehouse event append input is invalid' using errcode = '22023';
  end if;
  insert into momi_events.events (
    idempotency_key, event_name, entity_type, entity_id, occurred_at,
    schema_version, source_system, source_resource_type, source_id,
    source_reference, correlation_id
  ) values (
    p_idempotency_key, p_event_name, p_entity_type, p_entity_id,
    p_occurred_at, p_schema_version, p_source_system,
    p_source_resource_type, p_source_id, p_source_reference, p_correlation_id
  ) on conflict (idempotency_key) do nothing
  returning momi_events.events.event_id into v_inserted_id;
  if v_inserted_id is not null then
    disposition := 'stored'; event_id := v_inserted_id; return next; return;
  end if;
  select * into v_existing from momi_events.events
  where idempotency_key = p_idempotency_key;
  v_entity_version_replay := p_idempotency_key like
    'warehouse:entity-version:%'
    and p_event_name = 'warehouse.entity.observed'
    and v_existing.event_name in (
      p_event_name, 'warehouse.' || p_entity_type || '.observed'
    );
  if not found
    or (v_existing.event_name is distinct from p_event_name
      and not v_entity_version_replay)
    or v_existing.schema_version is distinct from p_schema_version
    or v_existing.idempotency_key is distinct from p_idempotency_key
    or v_existing.entity_type is distinct from p_entity_type
    or v_existing.entity_id is distinct from p_entity_id
    or (v_existing.occurred_at is distinct from p_occurred_at
      and not v_entity_version_replay)
    or v_existing.source_system is distinct from p_source_system
    or v_existing.source_resource_type is distinct from p_source_resource_type
    or v_existing.source_id is distinct from p_source_id
    or v_existing.source_reference is distinct from p_source_reference
    or (v_existing.correlation_id is distinct from p_correlation_id
      and not v_entity_version_replay) then
    raise exception 'warehouse event append replay conflicts' using errcode = '23505';
  end if;
  disposition := 'duplicate'; event_id := v_existing.event_id; return next;
end;
$$;

comment on function momi_events.append_warehouse_event_v1(
  text, integer, text, text, uuid, timestamptz,
  text, text, text, jsonb, uuid
) is 'Append one immutable warehouse reference; entity-version re-observation preserves the first event metadata.';

revoke all on function momi_events.begin_delivery(text, uuid, bigint, uuid)
  from public, anon, authenticated, service_role;
revoke all on function momi_events.begin_reserved_warehouse_projection_delivery_v1(
  uuid, bigint, uuid
) from public, anon, authenticated, service_role;
revoke all on function momi_events.ack_delivery(text, uuid, bigint, uuid)
  from public, anon, authenticated, service_role;
revoke all on function momi_events.fail_delivery(text, uuid, bigint, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function momi_events.read_order_alert_delivery_reference_v1(
  uuid, bigint, uuid
) from public, anon, authenticated, service_role;
revoke all on function momi_events.read_warehouse_projection_delivery_reference_v1(
  uuid, bigint, uuid
) from public, anon, authenticated, service_role;
revoke all on function momi_events.acquire_order_alert_delivery_witness_v1(
  uuid, bigint, uuid, integer
) from public, anon, authenticated, service_role;
revoke all on function momi_events.acquire_warehouse_projection_delivery_witness_v1(
  uuid, bigint, uuid, integer
) from public, anon, authenticated, service_role;
revoke all on function momi_events.authorize_order_alert_delivery_wake_v1(
  uuid, bigint, uuid
) from public, anon, authenticated, service_role;
revoke all on function momi_events.claim_warehouse_projection_delivery_v1()
  from public, anon, authenticated, service_role;
revoke all on function momi_events.reserve_warehouse_projection_delivery_v1(
  text, integer, integer
) from public, anon, authenticated, service_role;
revoke all on function momi_events.append_warehouse_event_v1(
  text, integer, text, text, uuid, timestamptz,
  text, text, text, jsonb, uuid
) from public, anon, authenticated, service_role;

grant execute on function momi_events.begin_delivery(text, uuid, bigint, uuid)
  to svc_order_alerting, svc_warehouse_projection;
grant execute on function momi_events.begin_reserved_warehouse_projection_delivery_v1(
  uuid, bigint, uuid
) to svc_warehouse_projection;
grant execute on function momi_events.ack_delivery(text, uuid, bigint, uuid)
  to svc_order_alerting, svc_warehouse_projection;
grant execute on function momi_events.fail_delivery(text, uuid, bigint, uuid, text)
  to svc_order_alerting, svc_warehouse_projection;
grant execute on function momi_events.read_order_alert_delivery_reference_v1(
  uuid, bigint, uuid
) to svc_order_alerting;
grant execute on function momi_events.read_warehouse_projection_delivery_reference_v1(
  uuid, bigint, uuid
) to svc_warehouse_projection;
grant execute on function momi_events.acquire_order_alert_delivery_witness_v1(
  uuid, bigint, uuid, integer
) to svc_order_alerting, svc_warehouse_read_api;
grant execute on function momi_events.acquire_warehouse_projection_delivery_witness_v1(
  uuid, bigint, uuid, integer
) to svc_warehouse_projection;
grant execute on function momi_events.authorize_order_alert_delivery_wake_v1(
  uuid, bigint, uuid
) to svc_order_alerting;
grant execute on function momi_events.claim_warehouse_projection_delivery_v1()
  to svc_warehouse_projection;
grant execute on function momi_events.reserve_warehouse_projection_delivery_v1(
  text, integer, integer
) to svc_warehouse_projection;
grant execute on function momi_events.append_warehouse_event_v1(
  text, integer, text, text, uuid, timestamptz,
  text, text, text, jsonb, uuid
) to svc_warehouse_projection;
