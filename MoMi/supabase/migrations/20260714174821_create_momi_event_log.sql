-- service-owner: momi-event-routing

create schema momi_events;

comment on schema momi_events is
  'Private source and warehouse event records plus delivery state.';

create table momi_events.events (
  event_id uuid primary key default gen_random_uuid(),
  event_name text not null,
  idempotency_key text not null unique,
  entity_type text,
  entity_id uuid,
  occurred_at timestamptz not null,
  schema_version integer not null,
  source_system text,
  source_resource_type text,
  source_id text,
  source_reference jsonb not null default '{}'::jsonb,
  correlation_id uuid not null,
  recorded_at timestamptz not null default now(),
  constraint events_name_valid check (
    event_name ~ '^(source\.[a-z0-9_]+\.[a-z0-9_.]+|warehouse\.[a-z0-9_.]+)$'
  ),
  constraint events_idempotency_key_present
    check (nullif(idempotency_key, '') is not null),
  constraint events_schema_version_positive check (schema_version > 0),
  constraint events_reference_is_object
    check (jsonb_typeof(source_reference) = 'object'),
  constraint warehouse_events_have_entity check (
    event_name not like 'warehouse.%'
    or (nullif(entity_type, '') is not null and entity_id is not null)
  )
);

create index events_entity_history_idx
  on momi_events.events (entity_type, entity_id, occurred_at desc)
  where entity_id is not null;
create index events_source_history_idx
  on momi_events.events (
    source_system, source_resource_type, source_id, occurred_at desc
  ) where source_id is not null;

alter table momi_events.events enable row level security;
revoke all on schema momi_events from public, anon, authenticated;
revoke all on table momi_events.events from public, anon, authenticated;
alter default privileges in schema momi_events
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema momi_events
  revoke all on sequences from public, anon, authenticated;

comment on table momi_events.events is
  'Append-only event metadata; source payloads remain in private raw storage.';
