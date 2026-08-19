import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { buildCurrentBroadSchemaOverlapReport } from
  "../scripts/architecture/build_current_broad_schema_overlap_report.ts"
import { buildDatabaseObjectAuthority } from
  "../scripts/architecture/build_database_object_authority.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import { validateJson } from "../scripts/architecture/validate_json.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"

const revision = "ff54beed51df9c75e25ec7eb8b5484fcb35e0769"

test("generation cannot alter database object authority", async () => {
  const before = buildDatabaseObjectAuthority(workspaceRoot, revision)
  const report = await buildCurrentBroadSchemaOverlapReport(
    workspaceRoot, revision,
  )
  const after = buildDatabaseObjectAuthority(workspaceRoot, revision)
  assert.deepEqual(after, before)
  assert.equal(after.authority.authority_digest,
    before.authority.authority_digest)
  assert.deepEqual(after.diagnostics, [])
  const rowKeys = new Set(Object.keys(report.rows[0]!))
  for (const forbidden of ["capability", "grant", "permission", "action",
    "remediation", "preserve", "revoke"]) assert.equal(
      rowKeys.has(forbidden), false,
    )
})

test("strict Execution Authority schemas reject reports", async () => {
  const report = await buildCurrentBroadSchemaOverlapReport(
    workspaceRoot, revision,
  )
  for (const name of ["execution-authority-v1.schema.json",
    "execution-authority-v2.schema.json"]) {
    const schema = await readJson<object>(join(workspaceRoot, "schemas", name))
    assert.throws(() => validateJson(schema, report, name))
  }
})

test("authority and execution modules do not import the report package", async () => {
  const root = join(workspaceRoot, "scripts", "architecture")
  const names = (await readdir(root)).filter((name) =>
    name.endsWith(".ts") && !name.includes("broad_schema_overlap_report"))
  const contents = await Promise.all(names.map((name) =>
    readFile(join(root, name), "utf8")))
  assert.equal(contents.some((source) =>
    source.includes("broad_schema_overlap_report") ||
    source.includes("broad-schema-overlap-report")), false)
  assert.equal(existsSync(join(
    workspaceRoot, "docs", "broad-schema-overlap-report.json",
  )), false)
})
