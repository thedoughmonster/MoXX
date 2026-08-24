-- service-owner: warehouse-read-api

create table momi_api.order_alert_delivery_bindings_v2 (
  read_capability_id bigint primary key
    references momi_api.read_capabilities(id) on delete cascade,
  event_id uuid,
  message_id bigint,
  delivery_token uuid,
  capability_expires_at timestamptz not null,
  bound_at timestamptz not null default statement_timestamp(),
  redacted_at timestamptz,
  constraint order_alert_delivery_binding_v2_expiry_valid
    check (capability_expires_at > bound_at),
  constraint order_alert_delivery_binding_v2_tuple_state check (
    (
      event_id is not null and message_id > 0
      and delivery_token is not null and redacted_at is null
    ) or (
      event_id is null and message_id is null
      and delivery_token is null and redacted_at is not null
    )
  )
);

create unique index order_alert_delivery_bindings_v2_active_tuple_idx
  on momi_api.order_alert_delivery_bindings_v2 (
    event_id, message_id, delivery_token
  ) where delivery_token is not null;

create index order_alert_delivery_bindings_v2_expiry_idx
  on momi_api.order_alert_delivery_bindings_v2 (capability_expires_at);

alter table momi_api.order_alert_delivery_bindings_v2
  enable row level security;

revoke all on table momi_api.order_alert_delivery_bindings_v2
  from public, anon, authenticated, service_role, svc_order_alerting;

create function momi_api.redact_order_alert_delivery_binding_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.revoked_at is not null or new.consumed_at is not null)
    and old.revoked_at is null and old.consumed_at is null then
    update momi_api.order_alert_delivery_bindings_v2 as binding
    set event_id = null, message_id = null, delivery_token = null,
      redacted_at = statement_timestamp()
    where binding.read_capability_id = new.id
      and binding.redacted_at is null;
  end if;
  return null;
end;
$$;

create trigger redact_order_alert_delivery_binding_v2
after update of revoked_at, consumed_at on momi_api.read_capabilities
for each row execute function
  momi_api.redact_order_alert_delivery_binding_v2();

revoke all on function momi_api.redact_order_alert_delivery_binding_v2()
  from public, anon, authenticated, service_role, svc_order_alerting;

create function momi_api.bind_order_alert_delivery_v2(
  p_read_capability_id bigint,
  p_read_capability_token uuid,
  p_event_id uuid,
  p_message_id bigint,
  p_delivery_token uuid
)
returns boolean
language plpgsql
volatile
strict
security definer
set search_path = ''
as $$
declare
  v_expires_at timestamptz;
begin
  if p_read_capability_id <= 0 or p_message_id <= 0 then
    return false;
  end if;

  delete from momi_api.order_alert_delivery_bindings_v2 as binding
  where binding.capability_expires_at <= statement_timestamp();

  update momi_api.read_capabilities as capability
  set binding_key = 'momi.order_alert_delivery.v2'
  where capability.id = p_read_capability_id
    and capability.capability_token = p_read_capability_token
    and capability.binding_key = 'momi.order_alert_delivery.v1'
    and capability.scope_entity_id is null
    and capability.revoked_at is null
    and capability.consumed_at is null
    and capability.expires_at > statement_timestamp()
    and capability.xmin = pg_current_xact_id()::xid
    and (
      (
        capability.function_key = 'momi.orders.get_by_id.v1'
        and capability.subject_version_id is null
      ) or (
        capability.function_key = 'momi.orders.get_by_version.v1'
        and capability.subject_version_id is not null
      )
    )
  returning capability.expires_at into v_expires_at;

  if not found then
    return false;
  end if;

  insert into momi_api.order_alert_delivery_bindings_v2 (
    read_capability_id, event_id, message_id, delivery_token,
    capability_expires_at
  ) values (
    p_read_capability_id, p_event_id, p_message_id, p_delivery_token,
    v_expires_at
  );
  return true;
end;
$$;

comment on function momi_api.bind_order_alert_delivery_v2(
  bigint, uuid, uuid, bigint, uuid
) is 'Binds one newly issued order-read capability to one delivery tuple.';

revoke all on function momi_api.bind_order_alert_delivery_v2(
  bigint, uuid, uuid, bigint, uuid
) from public, anon, authenticated, service_role;

grant execute on function momi_api.bind_order_alert_delivery_v2(
  bigint, uuid, uuid, bigint, uuid
) to svc_order_alerting;
