-- service-owner: momi-event-routing

insert into momi_runtime.function_registry (
  function_key, contract_version, function_type, active,
  owner_service, manifest_sha256
) values (
  'momi.events.route.v1', 1, 'coordinator', false,
  'momi-event-routing',
  'e83a0bad9c846d23ded6316a161a84353744b6086394575996d31df05255d3e7'
);

insert into momi_runtime.function_parameter_map (
  function_key, parameter_key, source_parameter_name,
  parameter_location, required, data_type, pass_to_source,
  store_in_run_log, display_order
) values
  ('momi.events.route.v1', 'event_id', 'event_id',
    'body', true, 'uuid', false, true, 1),
  ('momi.events.route.v1', 'capability_token', 'capability_token',
    'body', true, 'uuid', false, false, 2);

insert into momi_runtime.function_trigger_registry (
  trigger_key, function_key, contract_version, trigger_type,
  http_method, route_path, authentication_policy_key,
  active, owner_service
) values (
  'momi.events.route.http.v1', 'momi.events.route.v1', 1,
  'http', 'POST', '/functions/v1/momi-event-router-v1',
  'durable.work_token.v1', false, 'momi-event-routing'
);
