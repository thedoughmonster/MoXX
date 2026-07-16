-- service-owner: warehouse-projection
alter table warehouse_projection.worker_settings
  add column processor_mode text not null default 'edge'
    check (processor_mode in ('edge', 'database'));
create function warehouse_projection.enforce_edge_reservation_mode()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare current_mode text;
begin
  select processor_mode into strict current_mode
  from warehouse_projection.worker_settings
  where subscription_key = 'warehouse-projection-toast-v1'
  for share;
  if current_mode <> 'edge' then
    raise exception 'projection_processor_mode_database';
  end if;
  return new;
end;
$$;

create trigger enforce_edge_reservation_mode
before insert or update on warehouse_projection.delivery_reservations
for each row execute function
  warehouse_projection.enforce_edge_reservation_mode();

create function warehouse_projection.claim_database_delivery()
returns table (event_id uuid, message_id bigint, capability_token uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare target record; begun boolean;
begin
  if not exists (
    select 1 from warehouse_projection.worker_settings
    where subscription_key = 'warehouse-projection-toast-v1'
      and processor_mode = 'database'
  ) then return; end if;
  select delivery.event_id, delivery.queue_message_id,
    delivery.capability_token into target
  from momi_events.deliveries as delivery
  where delivery.subscription_key = 'warehouse-projection-toast-v1'
    and delivery.status = 'queued'
    and delivery.next_attempt_at <= now()
    and delivery.attempt_count < 12
    and delivery.queue_message_id is not null
    and delivery.capability_token is not null
  order by delivery.next_attempt_at, delivery.event_id
  limit 1 for update skip locked;
  if not found then return; end if;
  select momi_events.begin_delivery(
    'warehouse-projection-toast-v1', target.event_id,
    target.queue_message_id, target.capability_token
  ) into begun;
  if not coalesce(begun, false) then return; end if;
  return query select target.event_id, target.queue_message_id,
    target.capability_token;
end;
$$;

create procedure warehouse_projection.process_delivery_batch(
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
      perform 1 from momi_events.events as event
      where event.event_id = claimed.event_id
        and event.source_system = 'toast'
        and event.event_name like 'source.toast.%';
      if not found then raise exception 'source_event_mismatch'; end if;
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

revoke all on function warehouse_projection.enforce_edge_reservation_mode(),
  warehouse_projection.claim_database_delivery() from public, anon,
  authenticated;
revoke all on procedure warehouse_projection.process_delivery_batch(integer, integer)
  from public, anon, authenticated;
