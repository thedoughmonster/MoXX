-- service-owner: warehouse-read-api

create table momi_warehouse.entity_versions (
  entity_version_id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references momi_warehouse.entities(entity_id),
  schema_version integer not null,
  canonical_document jsonb not null,
  content_hash text not null,
  source_system text not null,
  source_resource_type text not null,
  source_id text not null,
  source_version_id text not null,
  source_observed_at timestamptz not null,
  projected_at timestamptz not null default now(),
  provenance jsonb not null,
  constraint entity_versions_schema_positive check (schema_version > 0),
  constraint entity_versions_document_object
    check (jsonb_typeof(canonical_document) = 'object'),
  constraint entity_versions_hash_valid
    check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint entity_versions_provenance_object
    check (jsonb_typeof(provenance) = 'object'),
  constraint entity_versions_source_unique unique (
    source_system, source_resource_type, source_id,
    source_version_id, content_hash
  )
);

create table momi_warehouse.version_observations (
  observation_id bigint generated always as identity primary key,
  source_observation_key text not null unique,
  entity_version_id uuid not null
    references momi_warehouse.entity_versions(entity_version_id),
  observed_at timestamptz not null,
  correlation_id uuid not null,
  source_reference jsonb not null,
  constraint version_observations_reference_object
    check (jsonb_typeof(source_reference) = 'object')
);

create table momi_warehouse.stock_observations (
  observation_id uuid primary key default gen_random_uuid(),
  source_observation_key text not null unique,
  item_entity_id uuid not null references momi_warehouse.entities(entity_id),
  location_entity_id uuid not null references momi_warehouse.entities(entity_id),
  observed_at timestamptz not null,
  stock_state text not null,
  quantity numeric,
  source_system text not null,
  source_reference jsonb not null,
  correlation_id uuid not null,
  recorded_at timestamptz not null default now(),
  constraint stock_observations_state_valid check (
    stock_state in ('IN_STOCK', 'LOW_QUANTITY', 'OUT_OF_STOCK', 'UNKNOWN')
  ),
  constraint stock_observations_reference_object
    check (jsonb_typeof(source_reference) = 'object')
);

create index entity_versions_latest_idx
  on momi_warehouse.entity_versions (entity_id, source_observed_at desc);
create index version_observations_version_idx
  on momi_warehouse.version_observations (entity_version_id, observed_at desc);
create index stock_observations_item_time_idx
  on momi_warehouse.stock_observations (item_entity_id, observed_at desc);

alter table momi_warehouse.entity_versions enable row level security;
alter table momi_warehouse.version_observations enable row level security;
alter table momi_warehouse.stock_observations enable row level security;
revoke all on all tables in schema momi_warehouse
  from public, anon, authenticated;
revoke all on all sequences in schema momi_warehouse
  from public, anon, authenticated;
