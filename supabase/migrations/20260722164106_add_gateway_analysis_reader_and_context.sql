-- service-owner: communications-gateway

create role svc_communications_gateway
  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

alter table momi_communications_gateway.assistant_context
  add column primary_location_name text,
  add column primary_timezone text;

update momi_communications_gateway.assistant_context
set primary_location_name = 'Berwick',
    primary_timezone = 'America/New_York',
    context_version = 'momi-context-v3'
where singleton;

alter table momi_communications_gateway.assistant_context
  alter column primary_location_name set not null,
  alter column primary_timezone set not null,
  add constraint assistant_context_primary_location_name_present
    check (length(primary_location_name) between 1 and 200),
  add constraint assistant_context_primary_timezone_present
    check (length(primary_timezone) between 1 and 100);

comment on role svc_communications_gateway is
  'Non-login role for the curated MoMi shop-analysis SELECT sandbox.';
