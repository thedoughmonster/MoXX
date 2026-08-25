export function buildLegacyRecipeIntegrationAssertions(importRunId: string): string {
  return `
do $test$
declare run_id uuid := '${importRunId}'::uuid;
begin
  if (select count(*) from legacy_recipe_staging.source_rows
      where import_run_id = run_id) <> 1 then
    raise exception 'idempotent source row count failed';
  end if;
  if (select count(*) from legacy_recipe_staging.repair_findings
      where import_run_id = run_id) <> 1 then
    raise exception 'idempotent finding count failed';
  end if;
  begin
    update legacy_recipe_staging.import_runs set source_package_id = 'tampered'
    where import_run_id = run_id;
    raise exception 'import run provenance update was accepted';
  exception when sqlstate '55000' then null;
  end;
  begin
    update legacy_recipe_staging.import_batches set batch_key = 'tampered'
    where import_run_id = run_id;
    raise exception 'import batch provenance update was accepted';
  exception when sqlstate '55000' then null;
  end;
  begin
    update legacy_recipe_staging.source_rows set source_row_key = 'tampered'
    where import_run_id = run_id;
    raise exception 'immutable row update was accepted';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from legacy_recipe_staging.import_runs where import_run_id = run_id;
    raise exception 'import run delete was accepted';
  exception when sqlstate '55000' then null;
  end;
  begin
    insert into legacy_recipe_staging.source_rows (
      source_row_id, import_run_id, source_table_id, source_row_key,
      source_ordinal, row_sha256, row_payload, row_document
    ) select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', run_id, source_table_id,
      '__bad_hash__', 999999, repeat('0', 64), '{}', '{}'::jsonb
    from legacy_recipe_staging.source_tables where import_run_id = run_id limit 1;
    raise exception 'invalid source payload hash was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into legacy_recipe_staging.repair_findings (
      repair_finding_id, import_run_id, source_file_id, finding_key,
      finding_ordinal, finding_category, finding_sha256,
      finding_payload, finding_document
    ) select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', run_id, source_file_id,
      '__bad_hash__', 999999, 'test', repeat('0', 64), '{}', '{}'::jsonb
    from legacy_recipe_staging.source_files
    where import_run_id = run_id and file_kind = 'repair_findings' limit 1;
    raise exception 'invalid finding payload hash was accepted';
  exception when check_violation then null;
  end;
end
$test$;
`
}
