-- service-owner: momi-event-routing

create role svc_momi_event_routing
  nologin noinherit nosuperuser nocreatedb nocreaterole
  noreplication nobypassrls;

comment on role svc_momi_event_routing is
  'Non-login capability role for momi-event-routing database contracts.';
