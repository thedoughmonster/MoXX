-- service-owner: momi-event-routing

update momi_events.routing_work as work
set status = 'succeeded',
    completed_at = coalesce(work.completed_at, now()),
    lease_expires_at = null
from momi_events.events as event
where event.event_id = work.event_id
  and event.idempotency_key like 'warehouse:canonical-resource-v2:%'
  and event.event_name like 'warehouse.%.reconciled'
  and work.status in ('pending', 'retry_wait')
  and not exists (
    select 1 from momi_events.subscriptions as subscription
    where subscription.active
      and event.recorded_at >= subscription.minimum_recorded_at
      and event.event_name like subscription.event_pattern
  )
  and not exists (
    select 1 from momi_events.deliveries as delivery
    where delivery.event_id = work.event_id
  );

do $$
begin
  if exists (
    select 1
    from momi_events.routing_work as work
    join momi_events.events as event using (event_id)
    where event.idempotency_key like 'warehouse:canonical-resource-v2:%'
      and event.event_name like 'warehouse.%.reconciled'
      and work.status in ('pending', 'retry_wait')
      and not exists (
        select 1 from momi_events.subscriptions as subscription
        where subscription.active
          and event.recorded_at >= subscription.minimum_recorded_at
          and event.event_name like subscription.event_pattern
      )
      and not exists (
        select 1 from momi_events.deliveries as delivery
        where delivery.event_id = work.event_id
      )
  ) then raise exception 'Unsubscribed replay routing remains pending'; end if;
end;
$$;
