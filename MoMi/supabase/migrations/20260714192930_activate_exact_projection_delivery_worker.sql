-- service-owner: warehouse-projection

update momi_runtime.function_registry
set manifest_sha256 =
  'afdf861ca80daf35e024658c71286e6b3222388078b15b422f2230bb62a996a9'
where function_key = 'momi.warehouse_projection.toast.consume.v1'
  and owner_service = 'warehouse-projection';

delete from momi_runtime.function_parameter_map
where function_key = 'momi.warehouse_projection.toast.consume.v1';

insert into momi_runtime.function_parameter_map (
  function_key, parameter_key, source_parameter_name,
  parameter_location, required, data_type, pass_to_source,
  store_in_run_log, display_order
) values
  ('momi.warehouse_projection.toast.consume.v1', 'event_id', 'event_id',
    'body', true, 'uuid', false, true, 1),
  ('momi.warehouse_projection.toast.consume.v1', 'message_id', 'message_id',
    'body', true, 'string', false, true, 2),
  ('momi.warehouse_projection.toast.consume.v1',
    'capability_token', 'capability_token',
    'body', true, 'uuid', false, false, 3);

update momi_runtime.function_trigger_registry
set authentication_policy_key = 'durable.work_token.v1'
where trigger_key = 'momi.warehouse_projection.toast.http.v1'
  and function_key = 'momi.warehouse_projection.toast.consume.v1'
  and owner_service = 'warehouse-projection';
