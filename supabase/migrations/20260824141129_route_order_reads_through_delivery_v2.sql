-- service-owner: warehouse-read-api

create or replace function momi_api.consume_read_capability(
  p_id bigint,
  p_function_key text,
  p_subject_entity_id uuid,
  p_scope_entity_id uuid,
  p_capability_token uuid
)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_capability momi_api.read_capabilities%rowtype;
  v_event_id uuid;
  v_message_id bigint;
  v_delivery_token uuid;
  v_witness_expiry timestamptz;
  v_is_order boolean :=
    p_function_key = 'momi.orders.get_by_id.v1';
begin
  if v_is_order then
    delete from momi_api.order_alert_delivery_bindings_v2 as binding
    where binding.capability_expires_at <= statement_timestamp();
  end if;

  select capability.* into v_capability
  from momi_api.read_capabilities as capability
  where capability.id = p_id
    and capability.function_key = p_function_key
    and capability.subject_entity_id = p_subject_entity_id
    and capability.scope_entity_id is not distinct from p_scope_entity_id
    and capability.capability_token = p_capability_token
    and capability.revoked_at is null
    and capability.consumed_at is null
    and capability.expires_at > statement_timestamp()
  for update;

  if not found then
    return null;
  end if;

  if v_is_order then
    if v_capability.scope_entity_id is not null
      or v_capability.subject_version_id is not null
      or v_capability.binding_key <> 'momi.order_alert_delivery.v2' then
      return null;
    end if;

    select binding.event_id, binding.message_id, binding.delivery_token
    into v_event_id, v_message_id, v_delivery_token
    from momi_api.order_alert_delivery_bindings_v2 as binding
    where binding.read_capability_id = v_capability.id
      and binding.capability_expires_at = v_capability.expires_at
      and binding.redacted_at is null
    for update;

    if not found then
      return null;
    end if;
  elsif v_capability.binding_key <> 'unbound' then
    return null;
  end if;

  update momi_api.read_capabilities as capability
  set consumed_at = statement_timestamp()
  where capability.id = v_capability.id
    and capability.consumed_at is null;

  if v_is_order then
    select witness.lease_expires_at into strict v_witness_expiry
    from momi_events.acquire_order_alert_delivery_witness_v1(
      v_event_id, v_message_id, v_delivery_token, 0
    ) as witness;
  end if;

  return v_capability.id::text;
end;
$$;

create or replace function momi_api.consume_versioned_read_capability(
  p_id bigint,
  p_function_key text,
  p_subject_entity_id uuid,
  p_subject_version_id uuid,
  p_capability_token uuid
)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_capability momi_api.read_capabilities%rowtype;
  v_event_id uuid;
  v_message_id bigint;
  v_delivery_token uuid;
  v_witness_expiry timestamptz;
begin
  delete from momi_api.order_alert_delivery_bindings_v2 as binding
  where binding.capability_expires_at <= statement_timestamp();

  select capability.* into v_capability
  from momi_api.read_capabilities as capability
  where capability.id = p_id
    and p_function_key = 'momi.orders.get_by_version.v1'
    and capability.function_key = p_function_key
    and capability.subject_entity_id = p_subject_entity_id
    and capability.subject_version_id = p_subject_version_id
    and capability.scope_entity_id is null
    and capability.capability_token = p_capability_token
    and capability.binding_key = 'momi.order_alert_delivery.v2'
    and capability.revoked_at is null
    and capability.consumed_at is null
    and capability.expires_at > statement_timestamp()
  for update;

  if not found then
    return null;
  end if;

  select binding.event_id, binding.message_id, binding.delivery_token
  into v_event_id, v_message_id, v_delivery_token
  from momi_api.order_alert_delivery_bindings_v2 as binding
  where binding.read_capability_id = v_capability.id
    and binding.capability_expires_at = v_capability.expires_at
    and binding.redacted_at is null
  for update;

  if not found then
    return null;
  end if;

  update momi_api.read_capabilities as capability
  set consumed_at = statement_timestamp()
  where capability.id = v_capability.id
    and capability.consumed_at is null;

  select witness.lease_expires_at into strict v_witness_expiry
  from momi_events.acquire_order_alert_delivery_witness_v1(
    v_event_id, v_message_id, v_delivery_token, 0
  ) as witness;

  return v_capability.id::text;
end;
$$;

comment on function momi_api.consume_read_capability(
  bigint, text, uuid, uuid, uuid
) is 'Consumes one local read capability and witnesses v2 order delivery.';

comment on function momi_api.consume_versioned_read_capability(
  bigint, text, uuid, uuid, uuid
) is 'Consumes one exact order capability and witnesses v2 delivery.';
