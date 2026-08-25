-- service-owner: warehouse-projection

create table warehouse_projection.worker_settings (
  subscription_key text primary key,
  max_parallel_deliveries integer not null
    check (max_parallel_deliveries between 1 and 32),
  updated_at timestamptz not null default now()
);

insert into warehouse_projection.worker_settings (
  subscription_key, max_parallel_deliveries
) values ('warehouse-projection-toast-v1', 4);

create table warehouse_projection.delivery_reservations (
  event_id uuid not null,
  subscription_key text not null,
  queue_message_id bigint not null,
  capability_token uuid not null,
  reserved_until timestamptz not null,
  primary key (event_id, subscription_key),
  unique (subscription_key, queue_message_id)
);

comment on table warehouse_projection.worker_settings is
  'Private concurrency limits for exact projection deliveries.';
comment on table warehouse_projection.delivery_reservations is
  'Short-lived exact wake reservations counted against worker capacity.';

create function warehouse_projection.begin_reserved_delivery(
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  begun boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(19482, 1);
  perform 1
  from warehouse_projection.delivery_reservations as reservation
  where reservation.event_id = p_event_id
    and reservation.subscription_key = 'warehouse-projection-toast-v1'
    and reservation.queue_message_id = p_message_id
    and reservation.capability_token = p_capability_token
    and reservation.reserved_until > now()
  for update;
  if not found then return false; end if;

  select momi_events.begin_delivery(
    'warehouse-projection-toast-v1', p_event_id,
    p_message_id, p_capability_token
  ) into begun;
  delete from warehouse_projection.delivery_reservations
  where event_id = p_event_id
    and subscription_key = 'warehouse-projection-toast-v1'
    and queue_message_id = p_message_id
    and capability_token = p_capability_token;
  return coalesce(begun, false);
end;
$$;

revoke all on table warehouse_projection.worker_settings,
  warehouse_projection.delivery_reservations
  from public, anon, authenticated;
revoke all on function warehouse_projection.begin_reserved_delivery(
  uuid, bigint, uuid
) from public, anon, authenticated;
