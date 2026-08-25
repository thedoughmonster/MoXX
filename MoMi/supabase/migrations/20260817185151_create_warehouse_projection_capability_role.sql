-- service-owner: warehouse-projection

create role svc_warehouse_projection
  nologin noinherit nosuperuser nocreatedb nocreaterole
  noreplication nobypassrls;

comment on role svc_warehouse_projection is
  'Non-login capability role for warehouse-projection database contracts.';
