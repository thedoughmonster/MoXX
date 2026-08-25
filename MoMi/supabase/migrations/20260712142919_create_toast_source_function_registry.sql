create table toast_hydration.function_registry (
  function_key text primary key,
  contract_version integer not null,
  function_type text not null,
  active boolean not null default false,
  owner_service text not null,
  manifest_sha256 text not null,
  created_at timestamptz not null default now(),
  constraint function_registry_key_present
    check (nullif(function_key, '') is not null),
  constraint function_registry_version_positive
    check (contract_version > 0),
  constraint function_registry_type_allowed
    check (function_type in ('primitive_source', 'coordinator', 'action', 'read')),
  constraint function_registry_owner_present
    check (nullif(owner_service, '') is not null),
  constraint function_registry_manifest_hash_valid
    check (manifest_sha256 ~ '^[0-9a-f]{64}$')
);

create table toast_hydration.function_parameter_map (
  function_key text not null
    references toast_hydration.function_registry(function_key),
  parameter_key text not null,
  source_parameter_name text not null,
  parameter_location text not null,
  required boolean not null,
  data_type text not null,
  allowed_values jsonb,
  validation_rule_key text,
  default_value jsonb,
  pass_to_source boolean not null,
  store_in_run_log boolean not null,
  display_order integer not null,
  primary key (function_key, parameter_key),
  constraint function_parameter_key_present
    check (nullif(parameter_key, '') is not null),
  constraint function_parameter_source_name_present
    check (nullif(source_parameter_name, '') is not null),
  constraint function_parameter_location_present
    check (nullif(parameter_location, '') is not null),
  constraint function_parameter_data_type_present
    check (nullif(data_type, '') is not null),
  constraint function_parameter_display_order_positive
    check (display_order > 0)
);

create table toast_hydration.function_trigger_registry (
  trigger_key text primary key,
  function_key text not null
    references toast_hydration.function_registry(function_key),
  contract_version integer not null,
  trigger_type text not null,
  http_method text,
  route_path text,
  schedule_policy_key text,
  authentication_policy_key text not null,
  active boolean not null default false,
  owner_service text not null,
  created_at timestamptz not null default now(),
  constraint function_trigger_key_present
    check (nullif(trigger_key, '') is not null),
  constraint function_trigger_version_positive
    check (contract_version > 0),
  constraint function_trigger_type_present
    check (nullif(trigger_type, '') is not null),
  constraint function_trigger_auth_present
    check (nullif(authentication_policy_key, '') is not null),
  constraint function_trigger_owner_present
    check (nullif(owner_service, '') is not null)
);

alter table toast_hydration.function_registry enable row level security;
alter table toast_hydration.function_parameter_map enable row level security;
alter table toast_hydration.function_trigger_registry enable row level security;

revoke all on all tables in schema toast_hydration
  from public, anon, authenticated;
