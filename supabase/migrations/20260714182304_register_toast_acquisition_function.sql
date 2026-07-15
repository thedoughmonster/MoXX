-- service-owner: toast-data-acquisition

insert into momi_runtime.function_registry (
  function_key, contract_version, function_type, active,
  owner_service, manifest_sha256
) values (
  'toast.data.acquisition.v1', 1, 'primitive_source', false,
  'toast-data-acquisition',
  '83be0417fac0a3af74383feb8041920ebaf3ee172a446548d8241d32c873940e'
);

insert into momi_runtime.function_parameter_map (
  function_key, parameter_key, source_parameter_name,
  parameter_location, required, data_type, pass_to_source,
  store_in_run_log, display_order
) values
  ('toast.data.acquisition.v1', 'job_id', 'job_id',
    'body', true, 'integer', false, true, 1),
  ('toast.data.acquisition.v1', 'capability_token', 'capability_token',
    'body', true, 'uuid', false, false, 2);

insert into momi_runtime.function_trigger_registry (
  trigger_key, function_key, contract_version, trigger_type,
  http_method, route_path, authentication_policy_key,
  active, owner_service
) values (
  'toast.data.acquisition.http.v1', 'toast.data.acquisition.v1', 1,
  'http', 'POST', '/functions/v1/toast-data-acquisition-v1',
  'durable.capability_token.v1', false, 'toast-data-acquisition'
);
