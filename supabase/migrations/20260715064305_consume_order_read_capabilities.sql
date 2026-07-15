-- service-owner: warehouse-read-api

create function momi_api.consume_read_capability(
  p_id bigint,
  p_function_key text,
  p_subject_entity_id uuid,
  p_scope_entity_id uuid,
  p_capability_token uuid
)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  with consumed as (
    update momi_api.read_capabilities as capability
    set consumed_at = now()
    where capability.id = p_id
      and capability.function_key = p_function_key
      and capability.subject_entity_id = p_subject_entity_id
      and capability.scope_entity_id is not distinct from p_scope_entity_id
      and capability.capability_token = p_capability_token
      and capability.revoked_at is null
      and capability.consumed_at is null
      and capability.expires_at > now()
      and (
        capability.binding_key = 'unbound'
        or (
          capability.binding_key = 'momi.order_alert_delivery.v1'
          and exists (
            select 1
            from momi_alerting.order_read_capability_uses as binding
            join momi_orders.api_invocation_attempts as attempt
              on attempt.id = binding.attempt_id
              and attempt.work_id = binding.api_work_id
            join momi_orders.api_invocation_work as work
              on work.id = binding.api_work_id
            join momi_alerting.order_event_bridges as bridge
              on bridge.api_work_id = work.id
              and bridge.event_id = binding.event_id
              and bridge.event_name = 'warehouse.order.observed'
            join momi_events.deliveries as delivery
              on delivery.event_id = binding.event_id
              and delivery.subscription_key = 'order-alerting-v1'
              and delivery.queue_message_id = binding.queue_message_id
            where binding.read_capability_id = capability.id
              and binding.revoked_at is null
              and attempt.outcome = 'running'
              and attempt.finished_at is null
              and work.status = 'running'
              and work.lease_expires_at > now()
              and work.api_contract_key = p_function_key
              and work.order_id::uuid = p_subject_entity_id
              and delivery.status = 'running'
              and delivery.lease_expires_at > now()
          )
        )
      )
    returning capability.id::text as work_id
  )
  select work_id from consumed;
$$;

revoke all on function momi_api.consume_read_capability(
  bigint, text, uuid, uuid, uuid
) from public, anon, authenticated;
