-- service-owner: order-alerting

drop index momi_alerting.order_alert_candidates_route_idx;
create index order_alert_candidates_route_idx
  on momi_alerting.order_alert_candidates (
    source_key, alert_kind, destination_key
  );
