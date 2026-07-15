-- service-owner: momi-event-routing

create function momi_events.reconcile_expired_deliveries(
  p_limit integer default 100
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  due record;
  source_event momi_events.events;
  reconciled integer := 0;
begin
  for due in
    select delivery.event_id, delivery.subscription_key,
      delivery.queue_message_id, delivery.attempt_count,
      subscription.queue_name, subscription.dead_letter_queue_name
    from momi_events.deliveries as delivery
    join momi_events.subscriptions as subscription using (subscription_key)
    where delivery.status = 'running'
      and delivery.lease_expires_at <= now()
      and delivery.queue_message_id is not null
    order by delivery.lease_expires_at
    for update of delivery skip locked
    limit greatest(1, least(p_limit, 500))
  loop
    if due.attempt_count >= 12 then
      perform pgmq.delete(due.queue_name, due.queue_message_id);
      select * into strict source_event
      from momi_events.events where event_id = due.event_id;
      perform pgmq.send(
        due.dead_letter_queue_name,
        momi_events.event_message(source_event),
        0
      );
      update momi_events.deliveries
      set status = 'dead_letter', queue_message_id = null,
          lease_expires_at = null, dead_lettered_at = now(),
          last_error = coalesce(last_error, 'worker lease expired')
      where event_id = due.event_id
        and subscription_key = due.subscription_key;
    else
      update momi_events.deliveries
      set status = 'queued', lease_expires_at = null,
          next_attempt_at = now(),
          capability_token = gen_random_uuid(),
          last_error = coalesce(last_error, 'worker lease expired')
      where event_id = due.event_id
        and subscription_key = due.subscription_key;
    end if;
    reconciled := reconciled + 1;
  end loop;
  return reconciled;
end;
$$;

select cron.schedule(
  'momi-expired-delivery-reconcile-v1',
  '15 seconds',
  'select momi_events.reconcile_expired_deliveries(100)'
);
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'momi-expired-delivery-reconcile-v1';

revoke all on function momi_events.reconcile_expired_deliveries(integer)
  from public, anon, authenticated;
