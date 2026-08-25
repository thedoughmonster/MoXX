-- service-owner: order-alerting

alter table momi_orders.api_invocation_work
  alter column location_id drop not null;

comment on column momi_orders.api_invocation_work.location_id is
  'Source location when known; canonical readers resolve it from the order.';

create table momi_alerting.order_event_bridges (
  event_id uuid primary key references momi_events.events(event_id),
  api_work_id bigint not null unique
    references momi_orders.api_invocation_work(id),
  event_name text not null,
  source_system text not null,
  source_order_id text not null,
  warehouse_version_id uuid not null unique,
  created_at timestamptz not null default now(),
  constraint order_event_bridges_live_event check (
    event_name = 'warehouse.order.observed'
  ),
  constraint order_event_bridges_source_present check (
    nullif(source_system, '') is not null
    and nullif(source_order_id, '') is not null
  )
);

alter table momi_alerting.order_source_mappings
  add column canonical_payload_path text[],
  add column canonical_expected_value jsonb;

alter table momi_alerting.alert_rule_conditions
  add column canonical_payload_path text[],
  add column canonical_expected_value jsonb;

alter table momi_alerting.order_event_bridges enable row level security;
revoke all on table momi_alerting.order_event_bridges
  from public, anon, authenticated;

comment on table momi_alerting.order_event_bridges is
  'Idempotent live warehouse event to canonical order API work bridge.';
