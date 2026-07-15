-- service-owner: warehouse-projection

insert into momi_runtime.function_registry (
  function_key, contract_version, function_type, active,
  owner_service, manifest_sha256
) values (
  'momi.warehouse_projection.toast.consume.v1', 1, 'coordinator', false,
  'warehouse-projection',
  'afdf861ca80daf35e024658c71286e6b3222388078b15b422f2230bb62a996a9'
);

insert into momi_runtime.function_parameter_map (
  function_key, parameter_key, source_parameter_name,
  parameter_location, required, data_type,
  pass_to_source, store_in_run_log, display_order
) values
  ('momi.warehouse_projection.toast.consume.v1', 'event_id', 'event_id',
    'body', true, 'uuid', false, true, 1),
  ('momi.warehouse_projection.toast.consume.v1', 'message_id', 'message_id',
    'body', true, 'string', false, true, 2),
  ('momi.warehouse_projection.toast.consume.v1',
    'capability_token', 'capability_token',
    'body', true, 'uuid', false, false, 3);

insert into momi_runtime.function_trigger_registry (
  trigger_key, function_key, contract_version, trigger_type,
  http_method, route_path, authentication_policy_key,
  active, owner_service
) values (
  'momi.warehouse_projection.toast.http.v1',
  'momi.warehouse_projection.toast.consume.v1', 1,
  'http', 'POST', '/functions/v1/momi-warehouse-projection-worker-v1',
  'durable.work_token.v1', false, 'warehouse-projection'
);
