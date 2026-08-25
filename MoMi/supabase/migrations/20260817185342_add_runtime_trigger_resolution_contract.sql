-- service-owner: runtime-registry

-- Normalize only the two legacy trigger-owner labels that survived their
-- function registrations' service-key alignment. The resolver still checks
-- every function and trigger fact independently.
update momi_runtime.function_trigger_registry
set owner_service = 'slack-order-delivery'
where trigger_key = 'momi.slack.order_alert.http.v1'
  and function_key = 'momi.slack.order_alert.deliver.v1'
  and owner_service = 'momi-slack-alert-delivery';

update momi_runtime.function_trigger_registry
set owner_service = 'toast-order-read-api'
where trigger_key = 'momi.toast_orders.get_by_id.http.v1'
  and function_key = 'momi.toast_orders.get_by_id.v1'
  and owner_service = 'momi-toast-order-api';

create function momi_runtime.resolve_communications_evaluation_trigger_v1()
returns table (contract_version integer, route_path text)
language sql stable security definer set search_path = ''
as $$
  with resolved as materialized (
    select function.contract_version, trigger.route_path
    from momi_runtime.function_registry as function
    join momi_runtime.function_trigger_registry as trigger
      on trigger.function_key = function.function_key
    where function.function_key = 'momi.communications.evaluate_item.v1'
      and function.contract_version = 1 and function.function_type = 'coordinator'
      and function.owner_service = 'communications-evaluation' and function.active
      and trigger.trigger_key = 'momi.communications.evaluate_item.http.v1'
      and trigger.contract_version = 1 and trigger.trigger_type = 'http'
      and trigger.http_method = 'POST'
      and trigger.route_path = '/functions/v1/momi-communications-evaluate-item-v1'
      and trigger.authentication_policy_key = 'durable.work_token.v1'
      and trigger.owner_service = function.owner_service and trigger.active
  )
  select resolved.contract_version, resolved.route_path from resolved
  where (select count(*) from resolved) = 1;
$$;

create function momi_runtime.resolve_event_router_trigger_v1()
returns table (contract_version integer, route_path text)
language sql stable security definer set search_path = ''
as $$
  with resolved as materialized (
    select function.contract_version, trigger.route_path
    from momi_runtime.function_registry as function
    join momi_runtime.function_trigger_registry as trigger
      on trigger.function_key = function.function_key
    where function.function_key = 'momi.events.route.v1'
      and function.contract_version = 1 and function.function_type = 'coordinator'
      and function.owner_service = 'momi-event-routing' and function.active
      and trigger.trigger_key = 'momi.events.route.http.v1'
      and trigger.contract_version = 1 and trigger.trigger_type = 'http'
      and trigger.http_method = 'POST'
      and trigger.route_path = '/functions/v1/momi-event-router-v1'
      and trigger.authentication_policy_key = 'durable.work_token.v1'
      and trigger.owner_service = function.owner_service and trigger.active
  )
  select resolved.contract_version, resolved.route_path from resolved
  where (select count(*) from resolved) = 1;
$$;

create function momi_runtime.resolve_order_alert_worker_trigger_v1()
returns table (contract_version integer, route_path text)
language sql stable security definer set search_path = ''
as $$
  with resolved as materialized (
    select function.contract_version, trigger.route_path
    from momi_runtime.function_registry as function
    join momi_runtime.function_trigger_registry as trigger
      on trigger.function_key = function.function_key
    where function.function_key = 'momi.orders.alert.evaluate.v1'
      and function.contract_version = 1 and function.function_type = 'action'
      and function.owner_service = 'order-alerting' and function.active
      and trigger.trigger_key = 'momi.orders.alert_worker.http.v1'
      and trigger.contract_version = 1 and trigger.trigger_type = 'http'
      and trigger.http_method = 'POST'
      and trigger.route_path = '/functions/v1/momi-order-alert-worker-v1'
      and trigger.authentication_policy_key =
        'momi.order_alert.delivery_capability_or_work_token.v1'
      and trigger.owner_service = function.owner_service and trigger.active
  )
  select resolved.contract_version, resolved.route_path from resolved
  where (select count(*) from resolved) = 1;
$$;

create function momi_runtime.resolve_slack_order_delivery_trigger_v1()
returns table (contract_version integer, route_path text)
language sql stable security definer set search_path = ''
as $$
  with resolved as materialized (
    select function.contract_version, trigger.route_path
    from momi_runtime.function_registry as function
    join momi_runtime.function_trigger_registry as trigger
      on trigger.function_key = function.function_key
    where function.function_key = 'momi.slack.order_alert.deliver.v1'
      and function.contract_version = 1 and function.function_type = 'action'
      and function.owner_service = 'slack-order-delivery' and function.active
      and trigger.trigger_key = 'momi.slack.order_alert.http.v1'
      and trigger.contract_version = 1 and trigger.trigger_type = 'http'
      and trigger.http_method = 'POST'
      and trigger.route_path = '/functions/v1/slack-order-alert-delivery-v1'
      and trigger.authentication_policy_key = 'durable.work_token.v1'
      and trigger.owner_service = function.owner_service and trigger.active
  )
  select resolved.contract_version, resolved.route_path from resolved
  where (select count(*) from resolved) = 1;
$$;

create function momi_runtime.resolve_warehouse_projection_trigger_v1()
returns table (contract_version integer, route_path text)
language sql stable security definer set search_path = ''
as $$
  with resolved as materialized (
    select function.contract_version, trigger.route_path
    from momi_runtime.function_registry as function
    join momi_runtime.function_trigger_registry as trigger
      on trigger.function_key = function.function_key
    where function.function_key = 'momi.warehouse_projection.toast.consume.v1'
      and function.contract_version = 1 and function.function_type = 'coordinator'
      and function.owner_service = 'warehouse-projection' and function.active
      and trigger.trigger_key = 'momi.warehouse_projection.toast.http.v1'
      and trigger.contract_version = 1 and trigger.trigger_type = 'http'
      and trigger.http_method = 'POST'
      and trigger.route_path = '/functions/v1/momi-warehouse-projection-worker-v1'
      and trigger.authentication_policy_key = 'durable.work_token.v1'
      and trigger.owner_service = function.owner_service and trigger.active
  )
  select resolved.contract_version, resolved.route_path from resolved
  where (select count(*) from resolved) = 1;
$$;

create function momi_runtime.resolve_order_alert_reader_trigger_v1(
  p_function_key text
)
returns table (contract_version integer, route_path text)
language sql stable security definer set search_path = ''
as $$
  with expected(function_key, trigger_key, owner_service, route_path, auth) as (
    values
      ('momi.orders.get_by_id.v1', 'momi.orders.get_by_id.http.v1',
        'warehouse-read-api', '/functions/v1/momi-orders-get-by-id-v1',
        'durable.read_capability.v1'),
      ('momi.orders.get_by_version.v1', 'momi.orders.get_by_version.http.v1',
        'warehouse-read-api', '/functions/v1/momi-orders-get-by-version-v1',
        'durable.read_capability.v1'),
      ('momi.toast_orders.get_by_id.v1', 'momi.toast_orders.get_by_id.http.v1',
        'toast-order-read-api', '/functions/v1/momi-toast-orders-get-by-id-v1',
        'durable.work_token.v1')
  ), resolved as materialized (
    select function.contract_version, trigger.route_path
    from expected
    join momi_runtime.function_registry as function
      on function.function_key = expected.function_key
    join momi_runtime.function_trigger_registry as trigger
      on trigger.function_key = function.function_key
     and trigger.trigger_key = expected.trigger_key
    where expected.function_key = p_function_key
      and function.contract_version = 1 and function.function_type = 'read'
      and function.owner_service = expected.owner_service and function.active
      and trigger.contract_version = 1 and trigger.trigger_type = 'durable_http'
      and trigger.http_method = 'POST' and trigger.route_path = expected.route_path
      and trigger.route_path like '/%' and trigger.route_path not like '//%'
      and trigger.authentication_policy_key = expected.auth
      and trigger.owner_service = function.owner_service and trigger.active
  )
  select resolved.contract_version, resolved.route_path from resolved
  where (select count(*) from resolved) = 1;
$$;

comment on function momi_runtime.resolve_order_alert_reader_trigger_v1(text) is
  'Bounded v1 active order-reader route resolution; incompatible legacy triggers return no row.';

revoke all on function momi_runtime.resolve_communications_evaluation_trigger_v1()
  from public, anon, authenticated, service_role;
revoke all on function momi_runtime.resolve_event_router_trigger_v1()
  from public, anon, authenticated, service_role;
revoke all on function momi_runtime.resolve_order_alert_worker_trigger_v1()
  from public, anon, authenticated, service_role;
revoke all on function momi_runtime.resolve_slack_order_delivery_trigger_v1()
  from public, anon, authenticated, service_role;
revoke all on function momi_runtime.resolve_warehouse_projection_trigger_v1()
  from public, anon, authenticated, service_role;
revoke all on function momi_runtime.resolve_order_alert_reader_trigger_v1(text)
  from public, anon, authenticated, service_role;

grant execute on function momi_runtime.resolve_communications_evaluation_trigger_v1()
  to svc_communications_evaluation;
grant execute on function momi_runtime.resolve_event_router_trigger_v1()
  to svc_momi_event_routing;
grant execute on function momi_runtime.resolve_order_alert_worker_trigger_v1()
  to svc_order_alerting;
grant execute on function momi_runtime.resolve_order_alert_reader_trigger_v1(text)
  to svc_order_alerting;
grant execute on function momi_runtime.resolve_slack_order_delivery_trigger_v1()
  to svc_slack_order_delivery;
grant execute on function momi_runtime.resolve_warehouse_projection_trigger_v1()
  to svc_warehouse_projection;
