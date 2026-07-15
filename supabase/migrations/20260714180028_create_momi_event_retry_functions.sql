-- service-owner: momi-event-routing
create function momi_events.begin_delivery(
  p_subscription_key text,
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  update momi_events.deliveries
  set status = 'running', attempt_count = attempt_count + 1,
      lease_expires_at = now() + interval '120 seconds'
  where subscription_key = p_subscription_key
    and event_id = p_event_id
    and queue_message_id = p_message_id
    and capability_token = p_capability_token
    and attempt_count < 12
    and (status = 'queued'
      or (status = 'running' and lease_expires_at <= now()))
  returning true;
$$;
create function momi_events.fail_delivery(
  p_subscription_key text,
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid,
  p_error text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare target momi_events.subscriptions;
  source_event momi_events.events; attempts integer;
begin
  select * into strict target from momi_events.subscriptions
  where subscription_key = p_subscription_key;
  select delivery.attempt_count into attempts
  from momi_events.deliveries as delivery
  where delivery.subscription_key = p_subscription_key
    and delivery.event_id = p_event_id
    and delivery.queue_message_id = p_message_id
    and delivery.capability_token = p_capability_token
    and delivery.status = 'running' and delivery.lease_expires_at > now()
  for update;
  if not found then return 'not_found'; end if;
  perform pgmq.delete(target.queue_name, p_message_id);
  if attempts >= 12 then
    select * into strict source_event
    from momi_events.events where event_id = p_event_id;
    perform pgmq.send(
      target.dead_letter_queue_name,
      momi_events.event_message(source_event),
      0
    );
    update momi_events.deliveries
    set status = 'dead_letter', attempt_count = attempts,
        queue_message_id = null, lease_expires_at = null,
        dead_lettered_at = now(), last_error = left(p_error, 4000)
    where subscription_key = p_subscription_key and event_id = p_event_id;
    return 'dead_letter';
  end if;
  update momi_events.deliveries
  set status = 'retry_wait', attempt_count = attempts,
      queue_message_id = null, lease_expires_at = null,
      next_attempt_at = now() + make_interval(
        secs => least(3600, 15 * power(2, attempts - 1)::integer)
      ),
      last_error = left(p_error, 4000)
  where subscription_key = p_subscription_key and event_id = p_event_id;
  return 'retry_wait';
end;
$$;
create function momi_events.enqueue_due_delivery_retries(p_limit integer default 100)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  due record;
  source_event momi_events.events;
  message_id bigint;
  enqueued integer := 0;
begin
  for due in
    select delivery.event_id, delivery.subscription_key, subscription.queue_name
    from momi_events.deliveries as delivery
    join momi_events.subscriptions as subscription using (subscription_key)
    where delivery.status = 'retry_wait'
      and delivery.next_attempt_at <= now() and subscription.active
    order by delivery.next_attempt_at
    for update of delivery skip locked
    limit greatest(1, least(p_limit, 500))
  loop
    select * into strict source_event
    from momi_events.events where event_id = due.event_id;
    select pgmq.send(
      due.queue_name, momi_events.event_message(source_event), 0
    ) into message_id;
    update momi_events.deliveries
    set status = 'queued', queue_message_id = message_id,
        capability_token = gen_random_uuid()
    where event_id = due.event_id
      and subscription_key = due.subscription_key;
    enqueued := enqueued + 1;
  end loop;
  return enqueued;
end;
$$;
revoke all on function momi_events.begin_delivery(text, uuid, bigint, uuid)
  from public, anon, authenticated;
revoke all on function momi_events.fail_delivery(text, uuid, bigint, uuid, text)
  from public, anon, authenticated;
revoke all on function momi_events.enqueue_due_delivery_retries(integer)
  from public, anon, authenticated;
