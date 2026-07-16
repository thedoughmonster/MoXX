-- service-owner: warehouse-projection

create schema if not exists legacy_recipe_staging;

create table legacy_recipe_staging.import_runs (
  import_run_id uuid primary key,
  source_package_id text not null unique,
  manifest_sha256 text not null unique,
  checksum_ledger_sha256 text not null unique,
  package_created_at timestamptz not null,
  importer_version text not null,
  run_status text not null default 'running',
  expected_file_count integer not null,
  expected_batch_count integer not null,
  expected_source_row_count bigint not null,
  expected_finding_count bigint not null,
  imported_source_row_count bigint not null default 0,
  imported_finding_count bigint not null default 0,
  failure_count integer not null default 0,
  checkpoint jsonb not null default '{}'::jsonb,
  manifest jsonb not null,
  started_at timestamptz not null default now(),
  resumed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  last_error_code text,
  last_error_at timestamptz,
  constraint import_runs_manifest_sha256_valid
    check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  constraint import_runs_ledger_sha256_valid
    check (checksum_ledger_sha256 ~ '^[0-9a-f]{64}$'),
  constraint import_runs_status_valid
    check (run_status in (
      'running', 'failed', 'imported', 'verified', 'verification_failed'
    )),
  constraint import_runs_counts_valid check (
    expected_file_count >= 0 and expected_batch_count >= 0
    and expected_source_row_count >= 0
    and expected_finding_count >= 0 and imported_source_row_count >= 0
    and imported_finding_count >= 0 and failure_count >= 0
  ),
  constraint import_runs_checkpoint_object
    check (jsonb_typeof(checkpoint) = 'object'),
  constraint import_runs_manifest_object
    check (jsonb_typeof(manifest) = 'object')
);

create table legacy_recipe_staging.source_files (
  source_file_id uuid primary key,
  import_run_id uuid not null
    references legacy_recipe_staging.import_runs(import_run_id),
  relative_path text not null,
  file_kind text not null,
  export_format text not null,
  byte_count bigint not null,
  file_sha256 text not null,
  expected_row_count bigint not null,
  rows_sha256 text not null,
  manifest_entry jsonb not null,
  verified_at timestamptz not null default now(),
  constraint source_files_run_path_unique
    unique (import_run_id, relative_path),
  constraint source_files_run_pair_unique
    unique (source_file_id, import_run_id),
  constraint source_files_kind_valid
    check (file_kind in ('source_table', 'repair_findings')),
  constraint source_files_format_valid
    check (export_format in (
      'json_array_of_objects', 'json_object_with_findings_array'
    )),
  constraint source_files_path_valid check (
    relative_path !~ '(^|/)\.\.(/|$)'
    and relative_path !~ '^[\\/]'
    and relative_path !~ '^[A-Za-z]:'
  ),
  constraint source_files_counts_valid
    check (byte_count >= 0 and expected_row_count >= 0),
  constraint source_files_hashes_valid check (
    file_sha256 ~ '^[0-9a-f]{64}$'
    and rows_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint source_files_manifest_object
    check (jsonb_typeof(manifest_entry) = 'object')
);

create table legacy_recipe_staging.import_batches (
  import_batch_id uuid primary key,
  import_run_id uuid not null
    references legacy_recipe_staging.import_runs(import_run_id),
  batch_key text not null,
  source_file_id uuid not null,
  batch_ordinal integer not null,
  first_source_ordinal bigint not null,
  last_source_ordinal bigint not null,
  expected_row_count integer not null,
  payload_sha256 text not null,
  batch_status text not null default 'planned',
  attempt_count integer not null default 0,
  applied_at timestamptz,
  last_error_code text,
  updated_at timestamptz not null default now(),
  constraint import_batches_file_run_fk
    foreign key (source_file_id, import_run_id)
    references legacy_recipe_staging.source_files(
      source_file_id, import_run_id
    ),
  constraint import_batches_run_key_unique
    unique (import_run_id, batch_key),
  constraint import_batches_file_ordinal_unique
    unique (source_file_id, batch_ordinal),
  constraint import_batches_ordinals_valid check (
    batch_ordinal >= 1 and first_source_ordinal >= 1
    and last_source_ordinal >= first_source_ordinal
    and expected_row_count = last_source_ordinal - first_source_ordinal + 1
  ),
  constraint import_batches_attempt_count_valid check (attempt_count >= 0),
  constraint import_batches_payload_hash_valid
    check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  constraint import_batches_status_valid
    check (batch_status in ('planned', 'applied', 'failed'))
);

create table legacy_recipe_staging.source_tables (
  source_table_id uuid primary key,
  import_run_id uuid not null,
  source_file_id uuid not null,
  source_database text not null,
  source_table_key text not null,
  expected_row_count bigint not null,
  rows_sha256 text not null,
  source_descriptor jsonb not null,
  imported_at timestamptz not null default now(),
  constraint source_tables_file_run_fk
    foreign key (source_file_id, import_run_id)
    references legacy_recipe_staging.source_files(
      source_file_id, import_run_id
    ),
  constraint source_tables_file_unique unique (source_file_id),
  constraint source_tables_run_key_unique
    unique (import_run_id, source_database, source_table_key),
  constraint source_tables_run_pair_unique
    unique (source_table_id, import_run_id),
  constraint source_tables_count_valid check (expected_row_count >= 0),
  constraint source_tables_hash_valid
    check (rows_sha256 ~ '^[0-9a-f]{64}$'),
  constraint source_tables_descriptor_object
    check (jsonb_typeof(source_descriptor) = 'object')
);

create table legacy_recipe_staging.source_rows (
  source_row_id uuid primary key,
  import_run_id uuid not null,
  source_table_id uuid not null,
  source_row_key text not null,
  source_ordinal bigint not null,
  row_sha256 text not null,
  row_payload text not null,
  row_document jsonb not null,
  imported_at timestamptz not null default now(),
  constraint source_rows_table_run_fk
    foreign key (source_table_id, import_run_id)
    references legacy_recipe_staging.source_tables(
      source_table_id, import_run_id
    ),
  constraint source_rows_table_key_unique
    unique (source_table_id, source_row_key),
  constraint source_rows_table_ordinal_unique
    unique (source_table_id, source_ordinal),
  constraint source_rows_ordinal_valid check (source_ordinal >= 1),
  constraint source_rows_hash_valid
    check (row_sha256 ~ '^[0-9a-f]{64}$'),
  constraint source_rows_payload_hash_valid check (
    encode(
      extensions.digest(convert_to(row_payload, 'UTF8'), 'sha256'), 'hex'
    ) = row_sha256
  ),
  constraint source_rows_payload_json_matches
    check (row_payload::jsonb = row_document),
  constraint source_rows_document_object
    check (jsonb_typeof(row_document) = 'object')
);

create table legacy_recipe_staging.repair_findings (
  repair_finding_id uuid primary key,
  import_run_id uuid not null,
  source_file_id uuid not null,
  finding_key text not null,
  finding_ordinal bigint not null,
  finding_category text not null,
  severity text,
  source_table_key text,
  source_row_key text,
  finding_sha256 text not null,
  finding_payload text not null,
  finding_document jsonb not null,
  imported_at timestamptz not null default now(),
  constraint repair_findings_file_run_fk
    foreign key (source_file_id, import_run_id)
    references legacy_recipe_staging.source_files(
      source_file_id, import_run_id
    ),
  constraint repair_findings_run_key_unique
    unique (import_run_id, finding_key),
  constraint repair_findings_file_ordinal_unique
    unique (source_file_id, finding_ordinal),
  constraint repair_findings_ordinal_valid check (finding_ordinal >= 1),
  constraint repair_findings_hash_valid
    check (finding_sha256 ~ '^[0-9a-f]{64}$'),
  constraint repair_findings_payload_hash_valid check (
    encode(
      extensions.digest(convert_to(finding_payload, 'UTF8'), 'sha256'), 'hex'
    ) = finding_sha256
  ),
  constraint repair_findings_payload_json_matches
    check (finding_payload::jsonb = finding_document),
  constraint repair_findings_document_object
    check (jsonb_typeof(finding_document) = 'object')
);

create table legacy_recipe_staging.reconciliation_results (
  reconciliation_result_id uuid primary key,
  import_run_id uuid not null
    references legacy_recipe_staging.import_runs(import_run_id),
  check_key text not null,
  expected_count bigint not null,
  actual_count bigint not null,
  expected_sha256 text not null,
  actual_sha256 text not null,
  passed boolean not null,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  constraint reconciliation_results_identity_unique unique (
    import_run_id, check_key, expected_count, actual_count,
    expected_sha256, actual_sha256
  ),
  constraint reconciliation_results_counts_valid
    check (expected_count >= 0 and actual_count >= 0),
  constraint reconciliation_results_hashes_valid check (
    expected_sha256 ~ '^[0-9a-f]{64}$'
    and actual_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint reconciliation_results_details_object
    check (jsonb_typeof(details) = 'object')
);

create index source_files_run_idx
  on legacy_recipe_staging.source_files (import_run_id);
create index import_batches_resume_idx
  on legacy_recipe_staging.import_batches (
    import_run_id, batch_status, batch_ordinal
  );
create index source_tables_run_idx
  on legacy_recipe_staging.source_tables (import_run_id, source_table_key);
create index source_rows_run_hash_idx
  on legacy_recipe_staging.source_rows (import_run_id, row_sha256);
create index repair_findings_run_category_idx
  on legacy_recipe_staging.repair_findings (
    import_run_id, finding_category, severity
  );
create index reconciliation_results_run_checked_idx
  on legacy_recipe_staging.reconciliation_results (
    import_run_id, checked_at desc
  );

create function legacy_recipe_staging.reject_immutable_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = format(
      '%I.%I is immutable after insert', tg_table_schema, tg_table_name
    );
end;
$$;

create function legacy_recipe_staging.guard_import_run_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) - array[
    'run_status', 'imported_source_row_count', 'imported_finding_count',
    'failure_count', 'checkpoint', 'resumed_at', 'completed_at', 'updated_at',
    'last_error_code', 'last_error_at'
  ] is distinct from to_jsonb(old) - array[
    'run_status', 'imported_source_row_count', 'imported_finding_count',
    'failure_count', 'checkpoint', 'resumed_at', 'completed_at', 'updated_at',
    'last_error_code', 'last_error_at'
  ] then
    raise exception using errcode = '55000',
      message = 'legacy recipe import run provenance is immutable';
  end if;
  return new;
end;
$$;

create function legacy_recipe_staging.guard_import_batch_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) - array[
    'batch_status', 'attempt_count', 'applied_at', 'last_error_code', 'updated_at'
  ] is distinct from to_jsonb(old) - array[
    'batch_status', 'attempt_count', 'applied_at', 'last_error_code', 'updated_at'
  ] then
    raise exception using errcode = '55000',
      message = 'legacy recipe import batch provenance is immutable';
  end if;
  return new;
end;
$$;

create trigger import_runs_update_guard
before update on legacy_recipe_staging.import_runs
for each row execute function
  legacy_recipe_staging.guard_import_run_update();
create trigger import_runs_no_delete
before delete or truncate on legacy_recipe_staging.import_runs
for each statement execute function
  legacy_recipe_staging.reject_immutable_change();
create trigger import_batches_update_guard
before update on legacy_recipe_staging.import_batches
for each row execute function
  legacy_recipe_staging.guard_import_batch_update();
create trigger import_batches_no_delete
before delete or truncate on legacy_recipe_staging.import_batches
for each statement execute function
  legacy_recipe_staging.reject_immutable_change();

create trigger source_files_immutable
before update or delete or truncate on legacy_recipe_staging.source_files
for each statement execute function
  legacy_recipe_staging.reject_immutable_change();
create trigger source_tables_immutable
before update or delete or truncate on legacy_recipe_staging.source_tables
for each statement execute function
  legacy_recipe_staging.reject_immutable_change();
create trigger source_rows_immutable
before update or delete or truncate on legacy_recipe_staging.source_rows
for each statement execute function
  legacy_recipe_staging.reject_immutable_change();
create trigger repair_findings_immutable
before update or delete or truncate on legacy_recipe_staging.repair_findings
for each statement execute function
  legacy_recipe_staging.reject_immutable_change();
create trigger reconciliation_results_immutable
before update or delete or truncate
on legacy_recipe_staging.reconciliation_results
for each statement execute function
  legacy_recipe_staging.reject_immutable_change();

alter table legacy_recipe_staging.import_runs enable row level security;
alter table legacy_recipe_staging.source_files enable row level security;
alter table legacy_recipe_staging.import_batches enable row level security;
alter table legacy_recipe_staging.source_tables enable row level security;
alter table legacy_recipe_staging.source_rows enable row level security;
alter table legacy_recipe_staging.repair_findings enable row level security;
alter table legacy_recipe_staging.reconciliation_results
  enable row level security;

revoke all on schema legacy_recipe_staging
  from public, anon, authenticated, service_role;
revoke all on all tables in schema legacy_recipe_staging
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema legacy_recipe_staging
  from public, anon, authenticated, service_role;
revoke all on all functions in schema legacy_recipe_staging
  from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema legacy_recipe_staging
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema legacy_recipe_staging
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema legacy_recipe_staging
  revoke all on functions from public, anon, authenticated, service_role;

comment on schema legacy_recipe_staging is
  'Private source-neutral staging for verified legacy recipe preservation.';
comment on table legacy_recipe_staging.source_rows is
  'Immutable complete JSON rows; no canonical recipe choice is represented.';
comment on table legacy_recipe_staging.repair_findings is
  'Imported repair evidence kept separate from preserved source facts.';
