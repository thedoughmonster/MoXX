-- service-owner: order-alerting

update momi_runtime.function_trigger_registry
set trigger_type = 'durable_http'
where trigger_key = 'momi.orders.get_by_id.http.v1'
  and function_key = 'momi.orders.get_by_id.v1'
  and route_path = '/functions/v1/momi-orders-get-by-id-v1'
  and authentication_policy_key = 'durable.read_capability.v1';

update momi_events.subscriptions
set event_pattern = 'warehouse.order.observed',
    active = false
where subscription_key = 'order-alerting-v1'
  and queue_name = 'order_alerting_v1';

create view momi_alerting.order_event_cutover_readiness_v1
with (security_invoker = true)
as
select
  exists (
    select 1 from momi_runtime.function_registry
    where function_key = 'momi.orders.alert.evaluate.v1'
      and owner_service = 'order-alerting' and active
  ) and exists (
    select 1 from momi_runtime.function_trigger_registry
    where trigger_key = 'momi.orders.alert_worker.http.v1'
      and route_path = '/functions/v1/momi-order-alert-worker-v1'
      and authentication_policy_key =
        'momi.order_alert.delivery_capability_or_work_token.v1'
      and active
  ) as worker_ready,
  exists (
    select 1 from momi_runtime.function_registry
    where function_key = 'momi.orders.get_by_id.v1'
      and function_type = 'read' and active
  ) and exists (
    select 1 from momi_runtime.function_trigger_registry
    where function_key = 'momi.orders.get_by_id.v1'
      and trigger_type = 'durable_http'
      and route_path = '/functions/v1/momi-orders-get-by-id-v1'
      and authentication_policy_key = 'durable.read_capability.v1' and active
  ) and exists (
    select 1 from momi_api.read_view_registry
    where view_key = 'momi.orders.get_by_id.v1'
      and view_or_function_name = 'orders_by_id_v1' and active
  ) as reader_ready,
  not exists (
    select 1
    from momi_alerting.order_source_mappings as mapping
    join momi_alerting.alert_rules as rule
      on rule.source_key = mapping.source_key and rule.is_enabled
    where mapping.is_enabled
      and (mapping.canonical_payload_path is null
        or mapping.canonical_expected_value is null
        or exists (
          select 1 from momi_alerting.alert_rule_conditions as condition
          where condition.rule_id = rule.id
            and (condition.canonical_payload_path is null
              or condition.canonical_expected_value is null)
        ))
  ) as mappings_ready,
  exists (
    select 1 from pg_constraint
    where conname = 'order_alert_candidates_destination_unique'
      and conrelid = 'momi_alerting.order_alert_candidates'::regclass
  ) as duplicate_safe,
  to_regprocedure(
    'momi_events.begin_delivery(text,uuid,bigint,uuid)'
  ) is not null
  and to_regprocedure(
    'momi_events.ack_delivery(text,uuid,bigint,uuid)'
  ) is not null
  and to_regprocedure(
    'momi_events.fail_delivery(text,uuid,bigint,uuid,text)'
  ) is not null
  and to_regprocedure(
    'momi_alerting.stage_order_event_work(uuid,bigint,uuid)'
  ) is not null as safe_ack_ready;

revoke all on table momi_alerting.order_event_cutover_readiness_v1
  from public, anon, authenticated;

comment on view momi_alerting.order_event_cutover_readiness_v1 is
  'Preconditions for a later post-deployment order alert activation migration.';
