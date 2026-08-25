-- service-owner: order-alerting

create role svc_order_alerting
  nologin noinherit nosuperuser nocreatedb nocreaterole
  noreplication nobypassrls;

comment on role svc_order_alerting is
  'Non-login capability role for order-alerting database contracts.';
