-- service-owner: order-alerting

create table momi_alerting.order_read_capability_uses (
  attempt_id bigint primary key references momi_orders.api_invocation_attempts(id),
  api_work_id bigint not null references momi_orders.api_invocation_work(id),
  read_capability_id bigint not null unique references momi_api.read_capabilities(id),
  event_id uuid not null references momi_events.events(event_id),
  queue_message_id bigint not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table momi_alerting.order_read_capability_uses enable row level security;
revoke all on table momi_alerting.order_read_capability_uses
  from public, anon, authenticated;
create function momi_alerting.issue_order_read_capability(
  p_api_work_id bigint,
  p_attempt_id bigint,
  p_invocation_id uuid,
  p_event_id uuid,
  p_message_id bigint,
  p_delivery_capability_token uuid
)
returns table (read_work_id text, capability_token uuid)
language plpgsql security invoker set search_path = ''
as $$
declare
  subject_id uuid;
  capability_expiry timestamptz;
  issued_id bigint;
  issued_token uuid;
begin
  select work.order_id::uuid,
    least(work.lease_expires_at, delivery.lease_expires_at,
      now() + interval '30 seconds')
  into subject_id, capability_expiry
  from momi_orders.api_invocation_work as work
  join momi_orders.api_invocation_attempts as attempt
    on attempt.work_id = work.id
  join momi_alerting.order_event_bridges as bridge
    on bridge.api_work_id = work.id
    and bridge.event_name = 'warehouse.order.observed'
  join momi_events.deliveries as delivery
    on delivery.event_id = bridge.event_id
    and delivery.subscription_key = 'order-alerting-v1'
  join momi_warehouse.entities as entity
    on entity.entity_id = work.order_id::uuid
    and entity.entity_type = 'order'
  where work.id = p_api_work_id
    and work.api_contract_key = 'momi.orders.get_by_id.v1'
    and work.status = 'running'
    and work.lease_expires_at > now() + interval '5 seconds'
    and attempt.id = p_attempt_id
    and attempt.invocation_id = p_invocation_id
    and attempt.outcome = 'running'
    and attempt.finished_at is null
    and delivery.event_id = p_event_id
    and delivery.queue_message_id = p_message_id
    and delivery.capability_token = p_delivery_capability_token
    and delivery.status = 'running'
    and delivery.lease_expires_at > now() + interval '5 seconds'
    and not exists (
      select 1 from momi_alerting.order_read_capability_uses as used
      where used.attempt_id = attempt.id
    )
  for update of work;
  if not found then
    raise exception using errcode = '42501',
      message = 'Canonical read capability is unavailable';
  end if;
  insert into momi_api.read_capabilities as issued (
    function_key, subject_entity_id, binding_key, expires_at
  ) values (
    'momi.orders.get_by_id.v1', subject_id,
    'momi.order_alert_delivery.v1', capability_expiry
  ) returning issued.id, issued.capability_token
    into issued_id, issued_token;
  insert into momi_alerting.order_read_capability_uses (
    attempt_id, api_work_id, read_capability_id, event_id, queue_message_id
  ) values (p_attempt_id, p_api_work_id, issued_id, p_event_id, p_message_id);
  return query select issued_id::text, issued_token;
end;
$$;
create function momi_alerting.revoke_order_read_capability(
  p_api_work_id bigint,
  p_attempt_id bigint,
  p_read_work_id bigint
)
returns boolean
language sql security invoker set search_path = ''
as $$
  with target as (
    select used.read_capability_id
    from momi_alerting.order_read_capability_uses as used
    where used.api_work_id = p_api_work_id
      and used.attempt_id = p_attempt_id
      and used.read_capability_id = p_read_work_id
      and used.revoked_at is null
    for update
  ), revoked as (
    update momi_api.read_capabilities as capability
    set revoked_at = now()
    from target
    where capability.id = target.read_capability_id
      and capability.revoked_at is null
    returning capability.id
  ), marked as (
    update momi_alerting.order_read_capability_uses as used
    set revoked_at = now()
    from revoked
    where used.read_capability_id = revoked.id
    returning used.read_capability_id
  )
  select exists (select 1 from marked);
$$;
revoke all on function momi_alerting.issue_order_read_capability(
  bigint,bigint,uuid,uuid,bigint,uuid)
  from public, anon, authenticated;
revoke all on function
  momi_alerting.revoke_order_read_capability(bigint,bigint,bigint)
  from public, anon, authenticated;
