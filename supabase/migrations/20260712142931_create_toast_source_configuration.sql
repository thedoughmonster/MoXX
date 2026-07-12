create table toast_hydration.api_sources (
  source_key text primary key,
  api_base_url text not null,
  client_id_secret_name text not null,
  client_secret_secret_name text not null,
  user_access_type text not null,
  request_timeout_ms integer not null,
  lease_duration_seconds integer not null,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint api_sources_key_present
    check (nullif(source_key, '') is not null),
  constraint api_sources_url_is_https
    check (api_base_url ~ '^https://'),
  constraint api_sources_client_id_secret_present
    check (nullif(client_id_secret_name, '') is not null),
  constraint api_sources_client_secret_present
    check (nullif(client_secret_secret_name, '') is not null),
  constraint api_sources_access_type_present
    check (nullif(user_access_type, '') is not null),
  constraint api_sources_timeout_valid
    check (request_timeout_ms between 1000 and 150000),
  constraint api_sources_lease_valid
    check (lease_duration_seconds between 30 and 3600)
);

create table toast_hydration.restaurants (
  source_key text not null
    references toast_hydration.api_sources(source_key),
  restaurant_guid text not null,
  display_name text not null default '',
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (source_key, restaurant_guid),
  constraint hydration_restaurant_guid_present
    check (nullif(restaurant_guid, '') is not null)
);

create table toast_hydration.webhook_order_mappings (
  mapping_key text primary key,
  source_key text not null
    references toast_hydration.api_sources(source_key),
  function_key text not null
    references toast_hydration.function_registry(function_key),
  event_type_path text[] not null,
  expected_event_type jsonb not null,
  restaurant_guid_path text[] not null,
  order_guid_path text[] not null,
  source_version_path text[] not null,
  fallback_identity_path text[] not null,
  downstream_api_contract_key text not null,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint webhook_order_mapping_key_present
    check (nullif(mapping_key, '') is not null),
  constraint webhook_order_mapping_api_contract_present
    check (nullif(downstream_api_contract_key, '') is not null),
  constraint webhook_order_mapping_paths_present
    check (
      array_length(event_type_path, 1) > 0
      and array_length(restaurant_guid_path, 1) > 0
      and array_length(order_guid_path, 1) > 0
      and array_length(source_version_path, 1) > 0
      and array_length(fallback_identity_path, 1) > 0
    )
);

create index webhook_order_mappings_source_key_idx
  on toast_hydration.webhook_order_mappings (source_key);
create index webhook_order_mappings_function_key_idx
  on toast_hydration.webhook_order_mappings (function_key);

alter table toast_hydration.api_sources enable row level security;
alter table toast_hydration.restaurants enable row level security;
alter table toast_hydration.webhook_order_mappings enable row level security;

revoke all on all tables in schema toast_hydration
  from public, anon, authenticated;
