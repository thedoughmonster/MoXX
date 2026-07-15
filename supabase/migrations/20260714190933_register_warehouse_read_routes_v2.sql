-- service-owner: warehouse-read-api

insert into momi_runtime.function_registry (
  function_key, contract_version, function_type, active,
  owner_service, manifest_sha256
) values
  ('momi.payments.get_by_id.v1', 1, 'read', false,
    'warehouse-read-api',
    '840a38d5d7e9fb970cb69a6790bc17dd120bdd7fcf8c521a4987575ab28542ca'),
  ('momi.menu_entities.get_by_id.v1', 1, 'read', false,
    'warehouse-read-api',
    'a893e5793c2e430e66f7f8477952d94a9ca426ac2ec067fbe37c0e8ae1e1de86'),
  ('momi.employees.get_by_id.v1', 1, 'read', false,
    'warehouse-read-api',
    '01b71951329d8c295ec2c50c8895fafc33b2a52000acfa35895b3a0888b7d47c'),
  ('momi.schedules.get_by_id.v1', 1, 'read', false,
    'warehouse-read-api',
    'c4bb50f6e85a0a67aa4313a8009e6993bd851e0549d0d7e8998cd04fff26b404'),
  ('momi.stock_observations.get_latest.v1', 1, 'read', false,
    'warehouse-read-api',
    '9b10400da5db899a38c49ec5a4efe1e70890f4934890e30db8a21bdd5aa6114f');

insert into momi_runtime.function_parameter_map (
  function_key, parameter_key, source_parameter_name,
  parameter_location, required, data_type, pass_to_source,
  store_in_run_log, display_order
)
select functions.function_key, parameters.parameter_key,
  parameters.parameter_key, 'body', true, parameters.data_type,
  false, parameters.store_in_run_log, parameters.display_order
from (values
  ('momi.payments.get_by_id.v1'),
  ('momi.menu_entities.get_by_id.v1'),
  ('momi.employees.get_by_id.v1'),
  ('momi.schedules.get_by_id.v1')
) as functions(function_key)
cross join (values
  ('work_id', 'string', false, 1),
  ('entity_id', 'uuid', true, 2),
  ('capability_token', 'uuid', false, 3)
) as parameters(parameter_key, data_type, store_in_run_log, display_order);

insert into momi_runtime.function_parameter_map (
  function_key, parameter_key, source_parameter_name,
  parameter_location, required, data_type, pass_to_source,
  store_in_run_log, display_order
) values
  ('momi.stock_observations.get_latest.v1', 'work_id', 'work_id',
    'body', true, 'string', false, false, 1),
  ('momi.stock_observations.get_latest.v1', 'item_id', 'item_id',
    'body', true, 'uuid', false, true, 2),
  ('momi.stock_observations.get_latest.v1', 'location_id', 'location_id',
    'body', true, 'uuid', false, true, 3),
  ('momi.stock_observations.get_latest.v1', 'capability_token',
    'capability_token', 'body', true, 'uuid', false, false, 4);

insert into momi_runtime.function_trigger_registry (
  trigger_key, function_key, contract_version, trigger_type,
  http_method, route_path, authentication_policy_key,
  active, owner_service
) values
  ('momi.payments.get_by_id.http.v1', 'momi.payments.get_by_id.v1', 1,
    'http', 'POST', '/functions/v1/momi-warehouse-payments-get-by-id-v1',
    'durable.read_capability.v1', false, 'warehouse-read-api'),
  ('momi.menu_entities.get_by_id.http.v1',
    'momi.menu_entities.get_by_id.v1', 1, 'http', 'POST',
    '/functions/v1/momi-warehouse-menu-entities-get-by-id-v1',
    'durable.read_capability.v1', false, 'warehouse-read-api'),
  ('momi.employees.get_by_id.http.v1', 'momi.employees.get_by_id.v1', 1,
    'http', 'POST', '/functions/v1/momi-warehouse-employees-get-by-id-v1',
    'durable.read_capability.v1', false, 'warehouse-read-api'),
  ('momi.schedules.get_by_id.http.v1', 'momi.schedules.get_by_id.v1', 1,
    'http', 'POST', '/functions/v1/momi-warehouse-schedules-get-by-id-v1',
    'durable.read_capability.v1', false, 'warehouse-read-api'),
  ('momi.stock_observations.get_latest.http.v1',
    'momi.stock_observations.get_latest.v1', 1, 'http', 'POST',
    '/functions/v1/momi-warehouse-stock-observations-get-by-id-v1',
    'durable.read_capability.v1', false, 'warehouse-read-api');
