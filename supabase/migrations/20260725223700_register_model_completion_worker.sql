-- service-owner: runtime-registry

insert into momi_runtime.function_registry (
  function_key, contract_version, function_type, active,
  owner_service, manifest_sha256
) values (
  'momi.model_execution.complete_background.v1', 1, 'coordinator', true,
  'model-execution-gateway',
  '13407f83cd961ee258e348495a3cd2e43034f3b560ebb9b22aba7d11f207b5ba'
);

insert into momi_runtime.function_parameter_map (
  function_key, parameter_key, source_parameter_name,
  parameter_location, required, data_type,
  pass_to_source, store_in_run_log, display_order
) values
  ('momi.model_execution.complete_background.v1', 'work_id', 'work_id',
    'body', true, 'uuid', false, true, 1),
  ('momi.model_execution.complete_background.v1', 'capability_token',
    'capability_token', 'body', true, 'uuid', false, false, 2);

insert into momi_runtime.function_trigger_registry (
  trigger_key, function_key, contract_version, trigger_type,
  http_method, route_path, authentication_policy_key,
  active, owner_service
) values (
  'momi.model_execution.complete_background.http.v1',
  'momi.model_execution.complete_background.v1', 1, 'http', 'POST',
  '/functions/v1/momi-model-execution-completion-worker-v1',
  'durable.work_token.v1', true, 'model-execution-gateway'
);
