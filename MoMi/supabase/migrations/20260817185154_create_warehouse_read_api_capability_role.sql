-- service-owner: warehouse-read-api

create role svc_warehouse_read_api
  nologin noinherit nosuperuser nocreatedb nocreaterole
  noreplication nobypassrls;

comment on role svc_warehouse_read_api is
  'Non-login capability role for warehouse-read-api database contracts.';
