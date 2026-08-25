-- service-owner: warehouse-projection

update momi_events.subscriptions
set event_pattern = 'warehouse.order.observed'
where subscription_key = 'order-alerting-v1'
  and consumer_service = 'order-alerting';

do $$
begin
  if not exists (
    select 1 from momi_events.subscriptions
    where subscription_key = 'order-alerting-v1'
      and event_pattern = 'warehouse.order.observed'
  ) then raise exception 'order_alert_subscription_missing'; end if;
end;
$$;

comment on column momi_events.subscriptions.event_pattern is
  'SQL LIKE pattern; operational order alerting uses the exact live observed event.';
