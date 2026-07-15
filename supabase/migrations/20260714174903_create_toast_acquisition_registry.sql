-- service-owner: toast-data-acquisition

create schema toast_acquisition;

comment on schema toast_acquisition is
  'Private allowlisted Toast acquisition commands, schedules, and work state.';

create table toast_acquisition.sources (
  source_key text primary key,
  api_base_url text not null,
  client_id_secret_name text not null,
  client_secret_secret_name text not null,
  user_access_type text not null,
  request_timeout_ms integer not null,
  is_enabled boolean not null default false,
  constraint acquisition_sources_url_https check (api_base_url ~ '^https://'),
  constraint acquisition_sources_timeout_valid
    check (request_timeout_ms between 1000 and 150000)
);

create table toast_acquisition.restaurants (
  source_key text not null references toast_acquisition.sources(source_key),
  restaurant_guid text not null,
  display_name text not null default '',
  first_business_date date,
  is_enabled boolean not null default false,
  primary key (source_key, restaurant_guid),
  constraint acquisition_restaurant_guid_present
    check (nullif(restaurant_guid, '') is not null)
);

create table toast_acquisition.operations (
  operation_key text primary key,
  source_operation_id text not null,
  http_method text not null default 'GET',
  path_template text not null,
  resource_type text not null,
  response_kind text not null,
  pagination_kind text not null,
  page_size integer,
  requires_window boolean not null default false,
  exact_resource_only boolean not null default false,
  schema_version integer not null default 1,
  is_enabled boolean not null default false,
  constraint operations_key_present check (nullif(operation_key, '') is not null),
  constraint operations_read_only check (http_method = 'GET'),
  constraint operations_path_absolute check (path_template like '/%'),
  constraint operations_response_valid
    check (response_kind in ('document', 'collection', 'status')),
  constraint operations_pagination_valid
    check (pagination_kind in ('none', 'page', 'cursor')),
  constraint operations_page_size_valid check (page_size is null or page_size > 0),
  constraint operations_schema_positive check (schema_version > 0)
);

create table toast_acquisition.operation_parameters (
  operation_key text not null
    references toast_acquisition.operations(operation_key),
  parameter_key text not null,
  parameter_location text not null,
  data_type text not null,
  required boolean not null default false,
  validation_pattern text,
  primary key (operation_key, parameter_key),
  constraint operation_parameters_location_valid
    check (parameter_location in ('path', 'query')),
  constraint operation_parameters_type_valid
    check (data_type in ('string', 'integer', 'boolean', 'timestamp', 'date'))
);

insert into toast_acquisition.sources
select source_key, api_base_url, client_id_secret_name,
  client_secret_secret_name, user_access_type, request_timeout_ms, is_enabled
from toast_hydration.api_sources;

insert into toast_acquisition.restaurants (
  source_key, restaurant_guid, display_name, is_enabled
)
select source_key, restaurant_guid, display_name, is_enabled
from toast_hydration.restaurants;

alter table toast_acquisition.sources enable row level security;
alter table toast_acquisition.restaurants enable row level security;
alter table toast_acquisition.operations enable row level security;
alter table toast_acquisition.operation_parameters enable row level security;
revoke all on schema toast_acquisition from public, anon, authenticated;
revoke all on all tables in schema toast_acquisition
  from public, anon, authenticated;
alter default privileges in schema toast_acquisition
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema toast_acquisition
  revoke all on sequences from public, anon, authenticated;
