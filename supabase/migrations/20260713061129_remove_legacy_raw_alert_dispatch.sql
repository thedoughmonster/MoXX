drop function if exists toast_alerting.process_order_alert_dispatch(bigint);
drop function if exists toast_alerting.enqueue_order_alert_dispatch();
drop function if exists toast_alerting.claim_order_alert_candidates(bigint);
drop table if exists toast_alerting.order_alert_dispatches;
