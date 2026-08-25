-- service-owner: warehouse-read-api

create schema momi_warehouse;

comment on schema momi_warehouse is
  'Private Dough Monster canonical entities and source provenance.';

create table momi_warehouse.entities (
  entity_id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  lifecycle_status text not null default 'active',
  merged_into_entity_id uuid references momi_warehouse.entities(entity_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entities_type_present
    check (nullif(entity_type, '') is not null),
  constraint entities_status_valid
    check (lifecycle_status in ('active', 'retired', 'merged')),
  constraint entities_merge_target_required check (
    lifecycle_status <> 'merged' or merged_into_entity_id is not null
  ),
  constraint entities_not_self_merged
    check (merged_into_entity_id is null or merged_into_entity_id <> entity_id)
);

create table momi_warehouse.source_links (
  source_system text not null,
  resource_type text not null,
  source_location_id text not null default '',
  source_id text not null,
  entity_id uuid not null references momi_warehouse.entities(entity_id),
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  linked_at timestamptz not null default now(),
  primary key (
    source_system, resource_type, source_location_id, source_id
  ),
  constraint source_links_system_present
    check (nullif(source_system, '') is not null),
  constraint source_links_resource_present
    check (nullif(resource_type, '') is not null),
  constraint source_links_id_present check (nullif(source_id, '') is not null),
  constraint source_links_observation_order
    check (last_observed_at >= first_observed_at)
);

create index source_links_entity_idx
  on momi_warehouse.source_links (entity_id);
create index entities_type_idx
  on momi_warehouse.entities (entity_type, entity_id);

alter table momi_warehouse.entities enable row level security;
alter table momi_warehouse.source_links enable row level security;
revoke all on schema momi_warehouse from public, anon, authenticated;
revoke all on all tables in schema momi_warehouse
  from public, anon, authenticated;
alter default privileges in schema momi_warehouse
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema momi_warehouse
  revoke all on sequences from public, anon, authenticated;
