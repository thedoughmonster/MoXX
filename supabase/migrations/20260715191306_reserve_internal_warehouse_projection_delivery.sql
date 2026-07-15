-- service-owner: warehouse-projection

create function warehouse_projection.reserve_internal_delivery()
returns table (
  event_id uuid,
  message_id bigint,
  capability_token uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_message_id bigint;
  v_token uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(19482, 1);
  delete from warehouse_projection.delivery_reservations as reservation
  where reservation.reserved_until <= now()
    or not exists (
      select 1 from momi_events.deliveries as delivery
      where delivery.event_id = reservation.event_id
        and delivery.subscription_key = reservation.subscription_key
        and delivery.status = 'queued'
        and delivery.queue_message_id = reservation.queue_message_id
        and delivery.capability_token = reservation.capability_token
    );
  if (
    select count(*)
    from momi_events.deliveries as delivery
    where delivery.subscription_key = 'warehouse-projection-toast-v1'
      and delivery.status = 'running'
      and delivery.lease_expires_at > now()
  ) + (
    select count(*)
    from warehouse_projection.delivery_reservations as reservation
    where reservation.subscription_key = 'warehouse-projection-toast-v1'
      and reservation.reserved_until > now()
  ) >= (
    select settings.max_parallel_deliveries
    from warehouse_projection.worker_settings as settings
    where settings.subscription_key = 'warehouse-projection-toast-v1'
  ) then return; end if;

  select delivery.event_id, delivery.queue_message_id
  into v_event_id, v_message_id
  from momi_events.deliveries as delivery
  where delivery.subscription_key = 'warehouse-projection-toast-v1'
    and delivery.status = 'queued'
    and delivery.next_attempt_at <= now()
    and delivery.queue_message_id is not null
    and not exists (
      select 1
      from warehouse_projection.delivery_reservations as reservation
      where reservation.event_id = delivery.event_id
        and reservation.subscription_key = delivery.subscription_key
    )
  order by delivery.next_attempt_at, delivery.event_id
  limit 1 for update skip locked;
  if not found then return; end if;

  v_token := gen_random_uuid();
  insert into warehouse_projection.delivery_reservations (
    event_id, subscription_key, queue_message_id,
    capability_token, reserved_until, dispatch_mode
  ) values (
    v_event_id, 'warehouse-projection-toast-v1', v_message_id,
    v_token, now() + interval '30 seconds', 'internal'
  );
  update momi_events.deliveries as delivery
  set capability_token = v_token
  where delivery.event_id = v_event_id
    and delivery.subscription_key = 'warehouse-projection-toast-v1'
    and delivery.status = 'queued'
    and delivery.queue_message_id = v_message_id;
  if not found then
    delete from warehouse_projection.delivery_reservations
    where event_id = v_event_id
      and subscription_key = 'warehouse-projection-toast-v1';
    return;
  end if;
  return query select v_event_id, v_message_id, v_token;
end;
$$;

comment on function warehouse_projection.reserve_internal_delivery() is
  'Reserves one exact next delivery for a bounded same-worker handoff.';

revoke all on function warehouse_projection.reserve_internal_delivery()
  from public, anon, authenticated;

do $$
begin
  if to_regprocedure(
    'warehouse_projection.reserve_internal_delivery()'
  ) is null then
    raise exception 'Internal projection handoff is missing';
  end if;
end;
$$;
