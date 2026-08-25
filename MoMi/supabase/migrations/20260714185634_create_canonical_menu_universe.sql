-- service-owner: warehouse-projection

create table momi_warehouse.menu_universe_versions (
  universe_version_id uuid primary key default gen_random_uuid(),
  location_entity_id uuid not null
    references momi_warehouse.entities(entity_id),
  schema_version integer not null default 1,
  source_system text not null,
  source_location_id text not null,
  source_version_id text not null,
  source_content_hash text not null,
  source_reference jsonb not null,
  projected_at timestamptz not null default now(),
  constraint menu_universe_schema_positive check (schema_version > 0),
  constraint menu_universe_hash_valid
    check (source_content_hash ~ '^[0-9a-f]{64}$'),
  constraint menu_universe_reference_object
    check (jsonb_typeof(source_reference) = 'object'),
  constraint menu_universe_source_unique unique (
    source_system, source_location_id, source_version_id, source_content_hash
  )
);

create table momi_warehouse.menu_universe_observations (
  observation_id bigint generated always as identity primary key,
  source_observation_key text not null unique,
  universe_version_id uuid not null
    references momi_warehouse.menu_universe_versions(universe_version_id),
  observed_at timestamptz not null,
  correlation_id uuid not null,
  source_reference jsonb not null,
  constraint menu_universe_observation_reference_object
    check (jsonb_typeof(source_reference) = 'object')
);

create table momi_warehouse.menu_universe_items (
  universe_version_id uuid not null
    references momi_warehouse.menu_universe_versions(universe_version_id),
  item_entity_id uuid not null references momi_warehouse.entities(entity_id),
  primary key (universe_version_id, item_entity_id)
);

create index menu_universe_location_idx
  on momi_warehouse.menu_universe_versions (
    source_system, source_location_id, projected_at desc
  );
create index menu_universe_observed_idx
  on momi_warehouse.menu_universe_observations (
    universe_version_id, observed_at desc
  );

alter table momi_warehouse.menu_universe_versions enable row level security;
alter table momi_warehouse.menu_universe_observations enable row level security;
alter table momi_warehouse.menu_universe_items enable row level security;
revoke all on all tables in schema momi_warehouse
  from public, anon, authenticated;
revoke all on all sequences in schema momi_warehouse
  from public, anon, authenticated;

comment on table momi_warehouse.menu_universe_versions is
  'Versioned source-neutral sets of valid canonical menu items.';
