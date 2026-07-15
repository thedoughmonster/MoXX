-- service-owner: order-alerting

drop function if exists
  momi_alerting.ack_order_event_delivery(uuid, bigint);
