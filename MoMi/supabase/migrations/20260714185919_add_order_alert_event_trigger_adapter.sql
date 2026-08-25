-- service-owner: order-alerting

update momi_runtime.function_registry
set manifest_sha256 =
  '80eb155ff512160dff5b24fcf295563a03592bdf2ceb930f12bab465eedf3d06'
where function_key = 'momi.orders.alert.evaluate.v1'
  and owner_service = 'order-alerting';

update momi_runtime.function_trigger_registry
set authentication_policy_key =
      'momi.order_alert.delivery_capability_or_work_token.v1',
    owner_service = 'order-alerting'
where trigger_key = 'momi.orders.alert_worker.http.v1'
  and function_key = 'momi.orders.alert.evaluate.v1';

update momi_runtime.function_parameter_map
set required = false
where function_key = 'momi.orders.alert.evaluate.v1'
  and parameter_key in ('work_id', 'trigger_token');

insert into momi_runtime.function_parameter_map (
  function_key, parameter_key, source_parameter_name,
  parameter_location, required, data_type, default_value,
  pass_to_source, store_in_run_log, display_order
) values
  ('momi.orders.alert.evaluate.v1', 'event_id', 'event_id',
    'body', false, 'uuid', null, false, true, 3),
  ('momi.orders.alert.evaluate.v1', 'message_id', 'message_id',
    'body', false, 'string', null, false, true, 4),
  ('momi.orders.alert.evaluate.v1', 'capability_token', 'capability_token',
    'body', false, 'uuid', null, false, false, 5)
on conflict (function_key, parameter_key) do update
set source_parameter_name = excluded.source_parameter_name,
    parameter_location = excluded.parameter_location,
    required = excluded.required,
    data_type = excluded.data_type,
    default_value = excluded.default_value,
    pass_to_source = excluded.pass_to_source,
    store_in_run_log = excluded.store_in_run_log,
    display_order = excluded.display_order;
