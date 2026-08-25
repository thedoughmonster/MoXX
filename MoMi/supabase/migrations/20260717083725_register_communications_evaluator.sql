-- service-owner: communications-archive

insert into momi_runtime.function_registry (
  function_key, contract_version, function_type, active,
  owner_service, manifest_sha256
) values (
  'momi.communications.evaluate_item.v1', 1, 'coordinator', false,
  'communications-archive',
  '5ab32381c03d31d5cdab9889986340c956486bada99ae199b2dbda420562db05'
);

insert into momi_runtime.function_parameter_map (
  function_key, parameter_key, source_parameter_name,
  parameter_location, required, data_type, pass_to_source,
  store_in_run_log, display_order
) values
  ('momi.communications.evaluate_item.v1', 'evaluation_job_id',
    'evaluation_job_id', 'body', true, 'bigint', false, true, 1),
  ('momi.communications.evaluate_item.v1', 'capability_token',
    'capability_token', 'body', true, 'uuid', false, false, 2);

insert into momi_runtime.function_trigger_registry (
  trigger_key, function_key, contract_version, trigger_type,
  http_method, route_path, schedule_policy_key,
  authentication_policy_key, active, owner_service
) values (
  'momi.communications.evaluate_item.http.v1',
  'momi.communications.evaluate_item.v1', 1, 'http', 'POST',
  '/functions/v1/momi-communications-evaluate-item-v1',
  'momi.communications.evaluator.schedule.v1',
  'durable.work_token.v1', false, 'communications-archive'
);
