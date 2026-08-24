import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { buildCurrentBroadSchemaOverlapReport } from
  "../scripts/architecture/build_current_broad_schema_overlap_report.ts"
import { buildBroadSchemaOverlapReport } from
  "../scripts/architecture/build_broad_schema_overlap_report.ts"
import { buildDatabaseObjectAuthority } from
  "../scripts/architecture/build_database_object_authority.ts"
import { calculateBroadSchemaOverlapReportDigest } from
  "../scripts/architecture/calculate_broad_schema_overlap_report_digest.ts"
import { loadDatabaseObjectAuthorityRevision } from
  "../scripts/architecture/load_database_object_authority_revision.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import { validateJson } from "../scripts/architecture/validate_json.ts"
import { validateBroadSchemaOverlapReport } from
  "../scripts/architecture/validate_broad_schema_overlap_report.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { loadTargetAccessBaselineFingerprints } from
  "../scripts/constitution/load_target_access_baseline_fingerprints.ts"

const fixture = await readJson<{
  revision: string; trusted_baseline_revision: string
}>(join(workspaceRoot, "tests", "fixtures", "broad-schema-overlap-report",
  "accepted-revision.json"))
const revision = fixture.revision

test("generation cannot alter database object authority", async () => {
  const before = buildDatabaseObjectAuthority(workspaceRoot, revision)
  const report = await buildCurrentBroadSchemaOverlapReport(
    workspaceRoot, revision, fixture.trusted_baseline_revision,
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

test("forged authority digest and null concrete kind cannot publish", async () => {
  const authoritySchema = await readJson<object>(join(
    workspaceRoot, "schemas", "database-object-authority-v1.schema.json"))
  const baselineSchema = await readJson<object>(join(
    workspaceRoot, "schemas", "service-access-debt-baseline-v1.schema.json"))
  const result = buildDatabaseObjectAuthority(workspaceRoot, revision)
  const source = loadDatabaseObjectAuthorityRevision(workspaceRoot, revision)
  result.authority.authority_digest = "0".repeat(64)
  assert.throws(() => buildBroadSchemaOverlapReport(result.authority,
    authoritySchema, source.legacy_debt.source, baselineSchema,
    loadTargetAccessBaselineFingerprints(fixture.trusted_baseline_revision)),
  /source_digest_drift/)
  const report = await buildCurrentBroadSchemaOverlapReport(
    workspaceRoot, revision, fixture.trusted_baseline_revision)
  const index = report.rows.findIndex((row) => row.exact_relation !== null)
  report.rows[index]!.relation_kind = null
  report.report_digest = calculateBroadSchemaOverlapReportDigest(report)
  const reportSchema = await readJson<object>(join(
    workspaceRoot, "schemas", "broad-schema-overlap-report-v1.schema.json"))
  assert.deepEqual(validateBroadSchemaOverlapReport(report, reportSchema).find((item) =>
    item.field_path === `/rows/${index}/classification`), {
    field_path: `/rows/${index}/classification`,
    code: "broad_overlap_report_identity_mismatch",
    target: report.rows[index]!.classification,
  })
})

test("strict Execution Authority schemas reject reports", async () => {
  const report = await buildCurrentBroadSchemaOverlapReport(
    workspaceRoot, revision, fixture.trusted_baseline_revision,
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
