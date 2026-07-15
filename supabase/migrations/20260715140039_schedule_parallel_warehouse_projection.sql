-- service-owner: warehouse-projection

create or replace function warehouse_projection.wake_next_delivery()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  active_deliveries integer;
  available_slots integer;
  parallel_limit integer;
  reserved_deliveries integer;
  target_event_id uuid;
  target_message_id bigint;
  target_token uuid;
  woken integer := 0;
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

  select settings.max_parallel_deliveries into strict parallel_limit
  from warehouse_projection.worker_settings as settings
  where settings.subscription_key = 'warehouse-projection-toast-v1';
  select count(*) into active_deliveries
  from momi_events.deliveries as delivery
  where delivery.subscription_key = 'warehouse-projection-toast-v1'
    and delivery.status = 'running'
    and delivery.lease_expires_at > now();
  select count(*) into reserved_deliveries
  from warehouse_projection.delivery_reservations as reservation
  where reservation.subscription_key = 'warehouse-projection-toast-v1'
    and reservation.reserved_until > now();
  available_slots := greatest(
    parallel_limit - active_deliveries - reserved_deliveries, 0
  );

  while woken < available_slots loop
    select delivery.event_id, delivery.queue_message_id
    into target_event_id, target_message_id
    from momi_events.deliveries as delivery
    where delivery.subscription_key = 'warehouse-projection-toast-v1'
      and delivery.status = 'queued'
      and delivery.next_attempt_at <= now()
      and delivery.queue_message_id is not null
      and not exists (
        select 1 from warehouse_projection.delivery_reservations as reserved
        where reserved.event_id = delivery.event_id
          and reserved.subscription_key = delivery.subscription_key
      )
    order by delivery.next_attempt_at, delivery.event_id
    limit 1 for update skip locked;
    exit when not found;

    target_token := gen_random_uuid();
    insert into warehouse_projection.delivery_reservations (
      event_id, subscription_key, queue_message_id,
      capability_token, reserved_until
    ) values (
      target_event_id, 'warehouse-projection-toast-v1', target_message_id,
      target_token, now() + interval '30 seconds'
    );
    update momi_events.deliveries
    set capability_token = target_token
    where event_id = target_event_id
      and subscription_key = 'warehouse-projection-toast-v1'
      and status = 'queued' and queue_message_id = target_message_id;
    woken := woken + 1;
  end loop;
  return woken > 0;
end;
$$;

revoke all on function warehouse_projection.wake_next_delivery()
  from public, anon, authenticated;

do $$
begin
  if (select max_parallel_deliveries
    from warehouse_projection.worker_settings
    where subscription_key = 'warehouse-projection-toast-v1') <> 4
  then raise exception 'Projection parallelism is invalid'; end if;
  if to_regprocedure(
    'warehouse_projection.begin_reserved_delivery(uuid,bigint,uuid)'
  ) is null then raise exception 'Projection reservation claim is missing'; end if;
  if (select count(*) from cron.job
    where jobname = 'momi-warehouse-projection-wakeup-v1'
      and active and schedule = '3 seconds'
      and command like '%warehouse_projection.wake_next_delivery()%') <> 1
  then raise exception 'Projection recovery cadence is invalid'; end if;
end;
$$;
