import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("diagnostic adapters preserve native failure mechanisms and flush exits", async () => {
  const catalog = await readFile("scripts/check_catalog.ts", "utf8")
  const migrations = await readFile("scripts/check_migrations.ts", "utf8")
  const edge = await readFile("scripts/check_edge_functions.ts", "utf8")
  const quality = await readFile("scripts/check_quality_report.ts", "utf8")
  const validity = await readFile("scripts/check_quality_report_validity.ts", "utf8")

  assert.match(catalog, /throw new Error\(renderRepositoryDiagnostics/u)
  assert.doesNotMatch(catalog, /process\.exit/u)
  assert.match(migrations, /throw new Error\(renderRepositoryDiagnostics/gu)
  assert.doesNotMatch(migrations, /process\.exit/u)
  assert.match(migrations, /rule_id === "MIGRATION_VALIDATION_FAILURE"/u)
  assert.equal(edge.match(/process\.stderr\.write\("", resolve\)/gu)?.length, 2)
  assert.equal(edge.match(/process\.exit\(/gu)?.length, 2)
  assert.match(quality, /console\.warn\(renderRepositoryDiagnostics/u)
  assert.match(quality, /process\.stderr\.write\("", resolve\)[\s\S]+process\.exit\(1\)/u)
  assert.match(validity, /throw new Error\(renderRepositoryDiagnostics/u)
  assert.doesNotMatch(validity, /process\.exit/u)
})

test("stderr drain preserves complete piped diagnostics and exit status", () => {
  const bytes = 4 * 1024 * 1024
  const result = spawnSync(process.execPath, [
    "--input-type=module",
    "--eval",
    `process.stderr.write("x".repeat(${bytes}));` +
      "await new Promise((resolve) => process.stderr.write(\"\", resolve));" +
      "process.exit(23)",
  ], { encoding: "utf8", maxBuffer: bytes * 2 })

  assert.equal(result.status, 23)
  assert.equal(result.stderr.length, bytes)
})
