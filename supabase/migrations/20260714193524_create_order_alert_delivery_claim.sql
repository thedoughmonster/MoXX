-- service-owner: order-alerting

create function momi_alerting.stage_order_event_work(
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid
)
returns table (
  disposition text,
  event_name text,
  work_id text,
  trigger_token text,
  work_status text
)
language sql
security invoker
set search_path = ''
as $$
  with target as (
    select event.event_id, event.event_name, event.entity_type,
      event.entity_id, event.source_system, event.source_id,
      event.source_reference
    from momi_events.events as event
    join momi_events.deliveries as delivery
      on delivery.event_id = event.event_id
    where delivery.subscription_key = 'order-alerting-v1'
      and delivery.event_id = p_event_id
      and delivery.queue_message_id = p_message_id
      and delivery.capability_token = p_capability_token
      and delivery.status = 'running'
      and delivery.lease_expires_at > now()
  ), live as (
    select * from target
    where target.event_name = 'warehouse.order.observed'
      and target.entity_type = 'order'
      and target.entity_id is not null
      and nullif(target.source_system, '') is not null
      and nullif(target.source_id, '') is not null
      and target.source_reference ->> 'schema' = 'momi_warehouse'
      and target.source_reference ->> 'table' = 'entity_versions'
      and target.source_reference ->> 'id' ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ), inserted_work as (
    insert into momi_orders.api_invocation_work (
      source_system, source_work_kind, source_work_id,
      source_resource_kind, source_version_id, location_id,
      order_id, api_contract_key
    )
    select live.source_system, 'warehouse_event', live.event_id::text,
      'order', live.source_reference ->> 'id', null,
      live.entity_id::text, 'momi.orders.get_by_id.v1'
    from live
    on conflict (
      source_system, source_resource_kind,
      source_version_id, api_contract_key
    ) do nothing
    returning id, trigger_token, status
  ), resolved_work as (
    select id, trigger_token, status from inserted_work
    union all
    select work.id, work.trigger_token, work.status
    from live
    join momi_orders.api_invocation_work as work
      on work.source_system = live.source_system
      and work.source_resource_kind = 'order'
      and work.source_version_id = live.source_reference ->> 'id'
      and work.api_contract_key = 'momi.orders.get_by_id.v1'
    where not exists (select 1 from inserted_work)
  ), inserted_bridge as (
    insert into momi_alerting.order_event_bridges (
      event_id, api_work_id, event_name, source_system,
      source_order_id, warehouse_version_id
    )
    select live.event_id, work.id, live.event_name, live.source_system,
      live.source_id, (live.source_reference ->> 'id')::uuid
    from live cross join resolved_work as work
    on conflict do nothing
    returning event_id, api_work_id
  ), resolved_bridge as (
    select event_id, api_work_id from inserted_bridge
    union all
    select bridge.event_id, bridge.api_work_id
    from live
    join momi_alerting.order_event_bridges as bridge
      on bridge.event_id = live.event_id
    where not exists (select 1 from inserted_bridge)
  )
  select 'ignored_non_live_event', target.event_name,
    null::text, null::text, null::text
  from target
  where target.event_name <> 'warehouse.order.observed'
  union all
  select 'ready', live.event_name, work.id::text,
    work.trigger_token::text, work.status
  from live cross join resolved_work as work
  join resolved_bridge as bridge
    on bridge.api_work_id = work.id and bridge.event_id = live.event_id;
$$;

comment on function momi_alerting.stage_order_event_work(uuid, bigint, uuid) is
  'Stages canonical alert work only for one running capability-fenced delivery.';
revoke all on function momi_alerting.stage_order_event_work(uuid, bigint, uuid)
  from public, anon, authenticated;
