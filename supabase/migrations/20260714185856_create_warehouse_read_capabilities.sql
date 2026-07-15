-- service-owner: warehouse-read-api

create table momi_api.read_capabilities (
  id bigint generated always as identity primary key,
  function_key text not null
    references momi_runtime.function_registry(function_key),
  subject_entity_id uuid not null
    references momi_warehouse.entities(entity_id),
  scope_entity_id uuid references momi_warehouse.entities(entity_id),
  binding_key text not null default 'unbound',
  capability_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  revoked_at timestamptz,
  consumed_at timestamptz,
  constraint read_capabilities_lifetime_valid
    check (expires_at > created_at),
  constraint read_capabilities_scope_distinct
    check (scope_entity_id is null or scope_entity_id <> subject_entity_id),
  constraint read_capabilities_binding_present
    check (nullif(binding_key, '') is not null),
  constraint order_read_capabilities_are_bound check (
    function_key <> 'momi.orders.get_by_id.v1' or binding_key <> 'unbound'
  ),
  constraint read_capabilities_consumed_after_creation
    check (consumed_at is null or consumed_at >= created_at)
);

create index read_capabilities_subject_idx
  on momi_api.read_capabilities (
    function_key, subject_entity_id, scope_entity_id, id
  ) where revoked_at is null and consumed_at is null;

comment on table momi_api.read_capabilities is
  'Expiring durable authorization for one source-neutral canonical read.';
comment on column momi_api.read_capabilities.subject_entity_id is
  'Canonical entity requested by the registered function contract.';
comment on column momi_api.read_capabilities.scope_entity_id is
  'Optional second canonical entity, such as a stock location.';

alter table momi_api.read_capabilities enable row level security;
revoke all on table momi_api.read_capabilities
  from public, anon, authenticated;
revoke all on sequence momi_api.read_capabilities_id_seq
  from public, anon, authenticated;
