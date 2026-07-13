with replacements (
  old_key, new_key, owner_service, manifest_sha256
) as (
  values
    (
      'momi.orders.get_by_guid.v1',
      'momi.toast_orders.get_by_id.v1',
      'momi-toast-order-api',
      '06baede59bf4d20db0c6b0f2d6aab76e27ff86a0d78c7549a16ce7ec435b50ab'
    ),
    (
      'toast.orders.alert_from_hydrated_order.v1',
      'momi.orders.alert.evaluate.v1',
      'momi-order-alert-worker',
      '991e13d32b22c0d5a5cf4ea030ad5f12514f5b1806a76a02734db5f474ecaed5'
    ),
    (
      'toast.slack_order_alert.deliver.v1',
      'momi.slack.order_alert.deliver.v1',
      'momi-slack-alert-delivery',
      'eb4dc298448bff197cf8439620f57d03c7a99ab00e8ef0ab23926ffefe168fe6'
    )
)
insert into momi_runtime.function_registry (
  function_key, contract_version, function_type, active,
  owner_service, manifest_sha256, created_at
)
select replacement.new_key, registry.contract_version,
  registry.function_type, registry.active, replacement.owner_service,
  replacement.manifest_sha256, registry.created_at
from replacements as replacement
join momi_runtime.function_registry as registry
  on registry.function_key = replacement.old_key;

with replacements (old_key, new_key) as (
  values
    ('momi.orders.get_by_guid.v1', 'momi.toast_orders.get_by_id.v1'),
    ('toast.orders.alert_from_hydrated_order.v1', 'momi.orders.alert.evaluate.v1'),
    ('toast.slack_order_alert.deliver.v1', 'momi.slack.order_alert.deliver.v1')
)
update momi_runtime.function_parameter_map as parameter
set function_key = replacement.new_key
from replacements as replacement
where parameter.function_key = replacement.old_key;

with replacements (
  old_trigger, new_trigger, old_function, new_function, owner_service, route_path
) as (
  values
    ('momi.orders.get_by_guid.http.v1', 'momi.toast_orders.get_by_id.http.v1',
      'momi.orders.get_by_guid.v1', 'momi.toast_orders.get_by_id.v1',
      'momi-toast-order-api', '/functions/v1/momi-toast-orders-get-by-id-v1'),
    ('toast.orders.alert_worker.http.v1', 'momi.orders.alert_worker.http.v1',
      'toast.orders.alert_from_hydrated_order.v1', 'momi.orders.alert.evaluate.v1',
      'momi-order-alert-worker', '/functions/v1/momi-order-alert-worker-v1'),
    ('toast.slack_order_alert.http.v1', 'momi.slack.order_alert.http.v1',
      'toast.slack_order_alert.deliver.v1', 'momi.slack.order_alert.deliver.v1',
      'momi-slack-alert-delivery', '/functions/v1/slack-order-alert-delivery-v1')
)
update momi_runtime.function_trigger_registry as trigger
set trigger_key = replacement.new_trigger,
    function_key = replacement.new_function,
    owner_service = replacement.owner_service,
    route_path = replacement.route_path
from replacements as replacement
where trigger.trigger_key = replacement.old_trigger
  and trigger.function_key = replacement.old_function;

delete from momi_runtime.function_registry
where function_key in (
  'momi.orders.get_by_guid.v1',
  'toast.orders.alert_from_hydrated_order.v1',
  'toast.slack_order_alert.deliver.v1'
);

create unique index function_trigger_registry_one_active_http_per_function_idx
  on momi_runtime.function_trigger_registry (function_key)
  where active and trigger_type = 'http';
