drop trigger if exists enqueue_order_alert_dispatch
  on toast_raw.order_webhook_events;

comment on table toast_alerting.order_alert_dispatches is
  'Historical raw-event dispatch state; superseded by hydrated Order API work.';
