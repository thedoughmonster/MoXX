import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { buildPlanFiles } from
  "../local-tools/legacy-recipe-import/build_plan_files.ts"
import { loadPackage } from
  "../local-tools/legacy-recipe-import/load_package.ts"
import { parseExecutionStatus } from
  "../local-tools/legacy-recipe-import/parse_execution_status.ts"
import { buildLegacyRecipeIntegrationAssertions } from
  "./legacy_recipe_integration_assertions.ts"
import { createLegacyRecipeTestPackage } from "./legacy_recipe_test_package.ts"
import { runLegacyRecipePsql } from "./legacy_recipe_wsl_psql.ts"

const enabled = process.env.MOMI_LEGACY_RECIPE_PG_INTEGRATION === "1"

test("executes and reconciles staging on real PostgreSQL", {
  skip: enabled ? false : "set MOMI_LEGACY_RECIPE_PG_INTEGRATION=1",
}, async (context) => {
  const database = `momi_legacy_recipe_${process.pid}`
  context.after(() => runLegacyRecipePsql("postgres", [
    `drop database if exists ${database} with (force);`,
    "drop role if exists anon, authenticated, service_role, postgres;",
  ].join("\n")))
  runLegacyRecipePsql("postgres", [
    `drop database if exists ${database} with (force);`,
    "do $$ begin",
    "  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;",
    "  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;",
    "  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;",
    "  if not exists (select from pg_roles where rolname = 'postgres') then create role postgres nologin; end if;",
    "end $$;",
    `create database ${database};`,
  ].join("\n"))
  runLegacyRecipePsql(database,
    "create schema extensions; create extension pgcrypto with schema extensions;")
  const migration = await readFile(new URL(
    "../supabase/migrations/20260716182635_create_legacy_recipe_staging.sql",
    import.meta.url,
  ), "utf8")
  runLegacyRecipePsql(database, migration)
  const fixture = await createLegacyRecipeTestPackage()
  const pkg = await loadPackage(fixture.root, fixture.trust)
  const files = buildPlanFiles(pkg)
  const importFiles = files.filter((file) => file.phase === "import")
  const verifyFiles = files.filter((file) => file.phase === "verification-query")
  const importFailure = files.find((file) => file.phase === "import-failure")
  const verifyFailure = files.find((file) => file.phase === "verification-failure")
  assert.ok(importFailure)
  assert.ok(verifyFailure)
  assert.equal(runLegacyRecipePsql(database, importFailure.sql), "")
  assert.equal(runLegacyRecipePsql(database, verifyFailure.sql), "")
  let result = ""
  for (const file of importFiles) result = runLegacyRecipePsql(database, file.sql)
  assert.equal(parseExecutionStatus(result), "imported")
  assert.equal(parseExecutionStatus(
    runLegacyRecipePsql(database, importFailure.sql),
  ), "failed")
  for (const file of importFiles) result = runLegacyRecipePsql(database, file.sql)
  assert.equal(parseExecutionStatus(result), "imported")
  const verifyComplete = verifyFiles.at(-1)
  assert.ok(verifyComplete)
  assert.equal(parseExecutionStatus(
    runLegacyRecipePsql(database, verifyComplete.sql),
  ), "verification_failed")
  assert.equal(runLegacyRecipePsql(database,
    "select run_status from legacy_recipe_staging.import_runs;"),
  "verification_failed")
  for (const file of verifyFiles) result = runLegacyRecipePsql(database, file.sql)
  assert.equal(parseExecutionStatus(result), "verified")
  runLegacyRecipePsql(database, buildLegacyRecipeIntegrationAssertions(pkg.importRunId))
  assert.equal(parseExecutionStatus(
    runLegacyRecipePsql(database, verifyFailure.sql),
  ), "verification_failed")
  for (const file of verifyFiles) result = runLegacyRecipePsql(database, file.sql)
  assert.equal(parseExecutionStatus(result), "verified")
  const summary = JSON.parse(runLegacyRecipePsql(database, `select jsonb_build_object(
    'status', r.run_status,
    'source_rows', (select count(*) from legacy_recipe_staging.source_rows),
    'findings', (select count(*) from legacy_recipe_staging.repair_findings),
    'checks', (select count(*) from legacy_recipe_staging.reconciliation_results),
    'all_passed', (select bool_and(passed) from legacy_recipe_staging.reconciliation_results)
  )::text from legacy_recipe_staging.import_runs r;`))
  assert.deepEqual(summary, {
    status: "verified", source_rows: 1, findings: 1, checks: 32,
    all_passed: true,
  })
})
