import assert from "node:assert/strict"
import test from "node:test"

import { buildPlanFiles } from
  "../local-tools/legacy-recipe-import/build_plan_files.ts"
import { confirmExecution } from
  "../local-tools/legacy-recipe-import/confirm_execution.ts"
import { loadPackage } from
  "../local-tools/legacy-recipe-import/load_package.ts"
import { sqlLiteral } from
  "../local-tools/legacy-recipe-import/sql_literal.ts"
import { stableUuid } from
  "../local-tools/legacy-recipe-import/stable_uuid.ts"
import { writePlan } from
  "../local-tools/legacy-recipe-import/write_plan.ts"
import { createLegacyRecipeTestPackage } from "./legacy_recipe_test_package.ts"

test("escapes SQL data without introducing an executable quote", () => {
  assert.equal(sqlLiteral("O'Brien"), "'O''Brien'")
  assert.equal(sqlLiteral(null), "null")
})

test("builds deterministic conflict-safe batches and verification queries", async () => {
  const fixture = await createLegacyRecipeTestPackage()
  const pkg = await loadPackage(fixture.root, fixture.trust)
  const first = buildPlanFiles(pkg)
  const second = buildPlanFiles(pkg)
  assert.deepEqual(first, second)
  const batch = first.find((file) => file.batch_key?.includes("recipe_versions"))
  assert.ok(batch)
  assert.match(batch.sql, /on conflict do nothing/)
  assert.match(batch.sql, /row_payload is distinct from i\.row_payload/)
  assert.match(batch.sql, /row_payload::jsonb/)
  assert.match(batch.sql, /checkpoint = checkpoint \|\|/)
  assert.match(batch.sql, /O''Brien Glaze/)
  assert.equal(first.filter((file) => file.phase === "verification-query").length, 17)
  assert.equal(first.filter((file) => file.phase.endsWith("-failure")).length, 2)
  assert.equal(first.every((file) => file.bytes <= 512 * 1024), true)
  assert.match(
    first.find((file) => file.file === "910001_verify.sql")?.sql ?? "",
    /extensions\.digest\(\s*convert_to\(r\.row_payload/,
  )
})

test("writes an idempotent ignored plan with stable file hashes", async () => {
  const fixture = await createLegacyRecipeTestPackage()
  const pkg = await loadPackage(fixture.root, fixture.trust)
  const files = buildPlanFiles(pkg)
  const first = await writePlan(pkg, files)
  const second = await writePlan(pkg, files)
  assert.equal(first.directory, second.directory)
  assert.deepEqual(first.plan, second.plan)
  assert.equal(first.plan.files.every((file) => /^[0-9a-f]{64}$/.test(file.sha256)), true)
})

test("uses stable UUID identities for automatic resume", () => {
  assert.equal(stableUuid("same"), stableUuid("same"))
  assert.notEqual(stableUuid("same"), stableUuid("different"))
})

test("requires an interactive typed confirmation for execution", async () => {
  await assert.rejects(confirmExecution("DO NOT RUN"), /interactive terminal/)
})
