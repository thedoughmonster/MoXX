-- service-owner: warehouse-read-api

insert into momi_runtime.function_registry (
  function_key, contract_version, function_type, active,
  owner_service, manifest_sha256
) values (
  'momi.orders.get_by_id.v1', 1, 'read', false,
  'warehouse-read-api',
  'a0098385fec89d16071b0b862bb2bb64ecccce29f2588259d5cc57c1dc76837e'
);

insert into momi_runtime.function_parameter_map (
  function_key, parameter_key, source_parameter_name,
  parameter_location, required, data_type, pass_to_source,
  store_in_run_log, display_order
) values
  ('momi.orders.get_by_id.v1', 'work_id', 'work_id',
    'body', true, 'string', false, false, 1),
  ('momi.orders.get_by_id.v1', 'order_id', 'order_id',
    'body', true, 'uuid', false, true, 2),
  ('momi.orders.get_by_id.v1', 'capability_token', 'capability_token',
    'body', true, 'uuid', false, false, 3);

insert into momi_runtime.function_trigger_registry (
  trigger_key, function_key, contract_version, trigger_type,
  http_method, route_path, authentication_policy_key,
  active, owner_service
) values (
  'momi.orders.get_by_id.http.v1', 'momi.orders.get_by_id.v1', 1,
  'http', 'POST', '/functions/v1/momi-orders-get-by-id-v1',
  'durable.read_capability.v1', false, 'warehouse-read-api'
);

insert into momi_api.read_view_registry (
  view_key, contract_version, schema_name, view_or_function_name,
  parameter_contract, result_contract, active, owner_service
) values
  ('momi.orders.get_by_id.v1', 1, 'momi_api', 'orders_by_id_v1',
    '{"entity_type":"order","id_type":"uuid"}',
    '{"document":"order_document","provenance":true,"freshness":true}',
    true, 'warehouse-read-api'),
  ('momi.payments.get_by_id.v1', 1, 'momi_api', 'payments_by_id_v1',
    '{"entity_type":"payment","id_type":"uuid"}',
    '{"document":"canonical_document","provenance":true,"freshness":true}',
    true, 'warehouse-read-api'),
  ('momi.menu_entities.get_by_id.v1', 1, 'momi_api', 'menu_entities_by_id_v1',
    '{"entity_type":"menu_entity","id_type":"uuid"}',
    '{"document":"canonical_document","provenance":true,"freshness":true}',
    true, 'warehouse-read-api'),
  ('momi.employees.get_by_id.v1', 1, 'momi_api', 'employees_by_id_v1',
    '{"entity_type":"employee","id_type":"uuid"}',
    '{"document":"canonical_document","provenance":true,"freshness":true}',
    true, 'warehouse-read-api'),
  ('momi.schedules.get_by_id.v1', 1, 'momi_api', 'schedules_by_id_v1',
    '{"entity_type":"schedule","id_type":"uuid"}',
    '{"document":"canonical_document","provenance":true,"freshness":true}',
    true, 'warehouse-read-api'),
  ('momi.stock_observations.get_latest.v1', 1, 'momi_api',
    'stock_observations_latest_v1',
    '{"item_id_type":"uuid","location_id_type":"uuid"}',
    '{"stock_state":true,"provenance":true,"freshness":true}',
    true, 'warehouse-read-api');
