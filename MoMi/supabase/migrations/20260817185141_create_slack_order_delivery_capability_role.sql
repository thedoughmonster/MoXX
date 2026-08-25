-- service-owner: slack-order-delivery

create role svc_slack_order_delivery
  nologin noinherit nosuperuser nocreatedb nocreaterole
  noreplication nobypassrls;

comment on role svc_slack_order_delivery is
  'Non-login capability role for slack-order-delivery database contracts.';
