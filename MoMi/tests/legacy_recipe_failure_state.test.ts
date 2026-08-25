import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { buildPlanFiles } from
  "../local-tools/legacy-recipe-import/build_plan_files.ts"
import { loadPackage } from
  "../local-tools/legacy-recipe-import/load_package.ts"
import { parseExecutionStatus } from
  "../local-tools/legacy-recipe-import/parse_execution_status.ts"
import { createLegacyRecipeTestPackage } from "./legacy_recipe_test_package.ts"

test("parses explicit psql and linked CLI status envelopes", () => {
  assert.equal(parseExecutionStatus(
    '{"legacy_recipe_status":"verified"}',
  ), "verified")
  assert.equal(parseExecutionStatus(JSON.stringify([{
    legacy_recipe_result: '{"legacy_recipe_status":"imported"}',
  }])), "imported")
  assert.throws(() => parseExecutionStatus("UPDATE 1"), /omitted/)
})

test("plans committed status and sealed backend-neutral failure markers", async () => {
  const fixture = await createLegacyRecipeTestPackage()
  const pkg = await loadPackage(fixture.root, fixture.trust)
  const files = buildPlanFiles(pkg)
  const complete = files.find((file) => file.file === "900000_complete.sql")
  const verify = files.find((file) => file.file === "920000_verify_complete.sql")
  const markers = files.filter((file) => file.phase.endsWith("-failure"))
  assert.ok(complete)
  assert.ok(verify)
  assert.equal(markers.length, 2)
  for (const file of [complete, verify, ...markers]) {
    assert.ok(file.sql.indexOf("commit;") < file.sql.indexOf("legacy_recipe_status"))
    assert.doesNotMatch(file.sql, /select 1 \/ case/)
  }
  assert.match(markers[0].sql, /where import_run_id = .*::uuid;/)
  assert.match(markers[0].sql, /last_error_code = 'execution_failed'/)
  assert.match(markers[1].sql, /verification_execution_failed/)
})

test("both runners use sealed markers and preserve the original error", async () => {
  for (const path of ["execute_plan.ts", "verify_package.ts"]) {
    const source = await readFile(new URL(
      `../local-tools/legacy-recipe-import/${path}`, import.meta.url,
    ), "utf8")
    assert.match(source, /await runFailureMarker/)
    assert.match(source, /throw error/)
  }
})
