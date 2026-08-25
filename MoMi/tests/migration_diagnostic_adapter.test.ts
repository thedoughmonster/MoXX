import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { loadTargetAuthoritySnapshot } from
  "../scripts/constitution/load_target_authority_snapshot.ts"
import type { MigrationDiagnosticPhase } from
  "../scripts/diagnostics/classify_migration_violation.ts"
import { migrationViolationDiagnostic } from
  "../scripts/diagnostics/migration_violation_diagnostic.ts"
import { renderRepositoryDiagnostics } from
  "../scripts/diagnostics/render_repository_diagnostics.ts"
import { renderMigrationViolations } from
  "../scripts/diagnostics/render_migration_violations.ts"
import { loadProductionMigrations } from
  "../scripts/migrations/load_production_migrations.ts"
import { assertRepositoryDiagnostics } from
  "./assert_repository_diagnostics.ts"

const fixture = JSON.parse(await readFile(
  "tests/fixtures/repository_check_diagnostics.fixture.json",
  "utf8",
)) as { migration: {
  path: string
  violations: string[]
  classification_cases: Array<{
    violation: string
    rule_id: string
    path?: string
    phase?: MigrationDiagnosticPhase
  }>
} }

test("adapts and groups migration violations without an unsafe fix", () => {
  const diagnostics = fixture.migration.violations.map((violation) =>
    migrationViolationDiagnostic(violation, fixture.migration.path)
  )
  assertRepositoryDiagnostics(diagnostics)
  const output = renderRepositoryDiagnostics(diagnostics)
  assert.match(output, /MIGRATION_SERVICE_OWNER_HEADER \(2 instances;/u)
  assert.match(output, /supabase\/migrations\/20260823000000_first\.sql/u)
  assert.match(output, /supabase\/migrations\/20260823000001_second\.sql/u)
  assert.match(output, /20260823000002_third\.sql:12/u)
  assert.match(output, /MIGRATION_INVENTORY_SHAPE/u)
  assert.match(output, /supabase\/migrations\/unexpected\.txt/u)
  assert.match(output, /fix: none \(no safe deterministic repair\)/u)
  assert.match(output, /validate: pnpm migration:check/u)
})

test("classifies reachable migration failures without fabricating paths", () => {
  for (const item of fixture.migration.classification_cases) {
    const diagnostic = migrationViolationDiagnostic(
      item.violation,
      fixture.migration.path,
      item.phase,
    )
    assertRepositoryDiagnostics([diagnostic])
    assert.equal(diagnostic.rule_id, item.rule_id, item.violation)
    assert.equal(diagnostic.location?.path, item.path, item.violation)
  }
})

test("keeps fingerprints stable across free-form condition prose", () => {
  const first = migrationViolationDiagnostic(
    "20260823000003_index.sql: unsupported index drop target /workspace/one",
    fixture.migration.path,
  )
  const second = migrationViolationDiagnostic(
    "20260823000003_index.sql: unsupported index drop target /workspace/two",
    fixture.migration.path,
  )

  assert.deepEqual(first.fingerprint, second.fingerprint)
  assert.doesNotMatch(JSON.stringify(first.fingerprint), /workspace/u)
  assert.deepEqual(
    renderRepositoryDiagnostics([first]).match(/sha256:[0-9a-f]{64}/gu),
    renderRepositoryDiagnostics([second]).match(/sha256:[0-9a-f]{64}/gu),
  )
})

test("renders the producer's unknown-owner violation through the driver seam", () => {
  const output = renderMigrationViolations([
    "20260823000010_owner.sql: unknown service owner missing-service",
  ], fixture.migration.path)

  assert.match(output, /MIGRATION_SERVICE_OWNER_HEADER/u)
  assert.match(output, /supabase\/migrations\/20260823000010_owner\.sql/u)
  assert.match(output, /existing service_key from a service manifest/u)
  assert.match(output, /validate: pnpm migration:check/u)
})

test("prioritizes routine qualification through the driver seam", () => {
  const output = renderMigrationViolations([
    "20260823000011_routine.sql: known routine app.recalculate must be schema-qualified",
  ], fixture.migration.path)

  assert.match(output, /MIGRATION_REFERENCE_QUALIFICATION/u)
  assert.match(output, /Qualify the reported object with its authoritative schema/u)
  assert.doesNotMatch(output, /MIGRATION_ROUTINE_AUTHORITY/u)
})

test("preserves native git execution errors from migration inputs", () => {
  const originalPath = process.env.PATH
  process.env.PATH = ""
  try {
    assert.throws(
      () => loadProductionMigrations(fixture.migration.path),
      (error: unknown) => error instanceof Error && "code" in error &&
        error.code === "ENOENT",
    )
    assert.throws(
      () => loadTargetAuthoritySnapshot(),
      (error: unknown) => error instanceof Error && "code" in error &&
        error.code === "ENOENT",
    )
  } finally {
    if (originalPath === undefined) delete process.env.PATH
    else process.env.PATH = originalPath
  }
})
