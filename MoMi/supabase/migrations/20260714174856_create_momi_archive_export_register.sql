-- service-owner: warehouse-read-api

create schema momi_archive;

comment on schema momi_archive is
  'Private coverage gaps and operator-managed source export evidence.';

create table momi_archive.product_gap_register (
  product_key text primary key,
  source_system text not null,
  product_name text not null,
  gap_description text not null,
  export_method text not null,
  cadence_days integer,
  last_export_at timestamptz,
  next_due_at timestamptz,
  operator_name text,
  archive_path text,
  sha256 text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint gap_register_key_present
    check (nullif(product_key, '') is not null),
  constraint gap_register_cadence_valid
    check (cadence_days is null or cadence_days > 0),
  constraint gap_register_hash_valid
    check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$')
);

create table momi_archive.export_runs (
  export_run_id uuid primary key default gen_random_uuid(),
  product_key text not null
    references momi_archive.product_gap_register(product_key),
  exported_at timestamptz not null,
  operator_name text not null,
  archive_path text not null,
  sha256 text not null,
  byte_size bigint,
  notes text,
  recorded_at timestamptz not null default now(),
  constraint export_runs_hash_valid check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint export_runs_size_valid check (byte_size is null or byte_size >= 0)
);

insert into momi_archive.product_gap_register (
  product_key, source_system, product_name, gap_description,
  export_method, cadence_days
) values (
  'toast-kitchen-fulfillment-204',
  'toast',
  'Kitchen fulfillment history',
  'HTTP 204 means KDS start, fulfillment, level, and prep timestamps are unavailable.',
  'Record each 204 response as an accepted capability gap.',
  null
);

alter table momi_archive.product_gap_register enable row level security;
alter table momi_archive.export_runs enable row level security;
revoke all on schema momi_archive from public, anon, authenticated;
revoke all on all tables in schema momi_archive
  from public, anon, authenticated;
