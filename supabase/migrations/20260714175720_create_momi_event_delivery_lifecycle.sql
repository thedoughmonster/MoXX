-- service-owner: momi-event-routing

create function momi_events.event_message(p_event momi_events.events)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'event_id', p_event.event_id,
    'entity_type', p_event.entity_type,
    'entity_id', p_event.entity_id,
    'occurred_at', p_event.occurred_at,
    'schema_version', p_event.schema_version,
    'source_reference', p_event.source_reference,
    'correlation_id', p_event.correlation_id
  ));
$$;

create function momi_events.route_event(
  p_event_id uuid,
  p_capability_token uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_event momi_events.events;
  target momi_events.subscriptions;
  message_id bigint;
  routed integer := 0;
begin
  if not exists (
    select 1 from momi_events.routing_work
    where event_id = p_event_id
      and capability_token = p_capability_token
      and status = 'running'
      and lease_expires_at > now()
  ) then raise exception 'Routing lease is invalid'; end if;

  select * into strict source_event
  from momi_events.events where event_id = p_event_id;
  for target in
    select * from momi_events.subscriptions
    where active and source_event.event_name like event_pattern
      and source_event.recorded_at >= minimum_recorded_at
    order by subscription_key
  loop
    insert into momi_events.deliveries (event_id, subscription_key)
    values (p_event_id, target.subscription_key)
    on conflict (event_id, subscription_key) do nothing;
    if exists (
      select 1 from momi_events.deliveries
      where event_id = p_event_id
        and subscription_key = target.subscription_key
        and status = 'pending'
    ) then
      select pgmq.send(
        target.queue_name,
        momi_events.event_message(source_event),
        0
      ) into message_id;
      update momi_events.deliveries
      set status = 'queued', queue_message_id = message_id,
          capability_token = gen_random_uuid()
      where event_id = p_event_id
        and subscription_key = target.subscription_key;
      routed := routed + 1;
    end if;
  end loop;
  update momi_events.routing_work
  set status = 'succeeded', completed_at = now(), lease_expires_at = null
  where event_id = p_event_id;
  return routed;
end;
$$;
create function momi_events.ack_delivery(
  p_subscription_key text,
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare queue_name text; message_deleted boolean;
begin
  select subscription.queue_name into queue_name
  from momi_events.deliveries as delivery
  join momi_events.subscriptions as subscription
    on subscription.subscription_key = delivery.subscription_key
  where delivery.subscription_key = p_subscription_key
    and delivery.event_id = p_event_id
    and delivery.queue_message_id = p_message_id
    and delivery.capability_token = p_capability_token
    and delivery.status = 'running' and delivery.lease_expires_at > now()
  for update of delivery;
  if not found then return false; end if;
  select pgmq.delete(queue_name, p_message_id) into message_deleted;
  if not coalesce(message_deleted, false) then return false; end if;
  update momi_events.deliveries
  set status = 'delivered', delivered_at = now(), queue_message_id = null,
      lease_expires_at = null
  where subscription_key = p_subscription_key
    and event_id = p_event_id and queue_message_id = p_message_id
    and capability_token = p_capability_token and status = 'running';
  return found;
end;
$$;
revoke all on function momi_events.event_message(momi_events.events)
  from public, anon, authenticated;
revoke all on function momi_events.route_event(uuid, uuid)
  from public, anon, authenticated;
revoke all on function momi_events.ack_delivery(text, uuid, bigint, uuid)
  from public, anon, authenticated;
