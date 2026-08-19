import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import test from "node:test"
import { buildBroadSchemaOverlapReport } from
  "../scripts/architecture/build_broad_schema_overlap_report.ts"
import { buildCurrentBroadSchemaOverlapReport } from
  "../scripts/architecture/build_current_broad_schema_overlap_report.ts"
import { buildDatabaseObjectAuthority } from
  "../scripts/architecture/build_database_object_authority.ts"
import { loadDatabaseObjectAuthorityRevision } from
  "../scripts/architecture/load_database_object_authority_revision.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import { renderBroadSchemaOverlapReport } from
  "../scripts/architecture/render_broad_schema_overlap_report.ts"
import { validateBroadSchemaOverlapReport } from
  "../scripts/architecture/validate_broad_schema_overlap_report.ts"
import { validateDatabaseObjectAuthority } from
  "../scripts/architecture/validate_database_object_authority.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { loadTargetAccessBaselineFingerprints } from
  "../scripts/constitution/load_target_access_baseline_fingerprints.ts"
const fixture = await readJson<{ revision: string; counts: Record<string, number>;
  input_digest: string; report_digest: string; sentinels: string[][] }>(join(
    workspaceRoot, "tests", "fixtures", "broad-schema-overlap-report",
    "accepted-revision.json",
  ))
const reportSchema = await readJson<object>(join(
  workspaceRoot, "schemas", "broad-schema-overlap-report-v1.schema.json",
))
const baselineSchema = await readJson<object>(join(
  workspaceRoot, "schemas", "service-access-debt-baseline-v1.schema.json",
))
const authoritySchema = await readJson<object>(join(
  workspaceRoot, "schemas", "database-object-authority-v1.schema.json",
))
test("reproduces the accepted 83 declaration and 635 row projection", async () => {
  const first = await buildCurrentBroadSchemaOverlapReport(workspaceRoot,
    fixture.revision)
  const second = await buildCurrentBroadSchemaOverlapReport(workspaceRoot,
    `${fixture.revision}^{commit}`)
  assert.deepEqual(first.counts, fixture.counts)
  assert.equal(first.input_digest, fixture.input_digest)
  assert.equal(first.report_digest, fixture.report_digest)
  assert.equal(renderBroadSchemaOverlapReport(first),
    renderBroadSchemaOverlapReport(second))
  assert.equal(renderBroadSchemaOverlapReport(first),
    `${canonicalJson(first)}\n`)
  assert.deepEqual(validateBroadSchemaOverlapReport(first, reportSchema), [])
  const sentinels = first.rows.filter((row) =>
    row.classification === "undiscoverable").map((row) => [
      row.declaring_service, row.compatibility_mode, row.broad_schema,
    ])
  assert.deepEqual(sentinels, fixture.sentinels)
  assert(first.rows.filter((row) => row.exact_relation !== null).every((row) =>
    row.declaration_source.source_path.startsWith("services/") &&
    row.object_source?.source_path.startsWith("services/") &&
    Boolean(row.object_source.replay_identity)))
  assert.equal(first.rows.some((row) => row.exact_relation?.schema === "cron" &&
    row.exact_relation.name === "job_run_details"), false)
})
test("fails stale and invalid baseline inputs without a report", () => {
  const result = buildDatabaseObjectAuthority(workspaceRoot, fixture.revision)
  const source = loadDatabaseObjectAuthorityRevision(
    workspaceRoot, fixture.revision,
  )
  const stale = structuredClone(result.authority)
  stale.legacy_debt_reference.digest = "0".repeat(64)
  assert.throws(() => buildBroadSchemaOverlapReport(stale,
    source.legacy_debt.source, baselineSchema,
    loadTargetAccessBaselineFingerprints()),
  /broad_overlap_debt_reference_mismatch/)
  assert.throws(() => buildBroadSchemaOverlapReport(result.authority,
    "{", baselineSchema, loadTargetAccessBaselineFingerprints()),
  /legacy_report_source_json_invalid/)
})
test("detects unsupported shape, identity, count, order, and digest drift", async () => {
  const report = await buildCurrentBroadSchemaOverlapReport(
    workspaceRoot, fixture.revision,
  )
  const version = structuredClone(report) as unknown as Record<string, unknown>
  version.schema_version = "broad-schema-overlap-report/v2"
  assert(validateBroadSchemaOverlapReport(version, reportSchema).some((item) =>
    item.code === "broad_overlap_report_schema_invalid"))
  const unsupportedAuthority = structuredClone(
    buildDatabaseObjectAuthority(workspaceRoot, fixture.revision).authority,
  ) as unknown as Record<string, unknown>
  unsupportedAuthority.schema_version = "database-object-authority/v2"
  assert(validateDatabaseObjectAuthority(
    unsupportedAuthority, authoritySchema,
  ).some((item) => item.code === "unknown_version"))
  const identity = structuredClone(report)
  identity.rows[0]!.row_identity = "changed"
  assert(validateBroadSchemaOverlapReport(identity, reportSchema).some((item) =>
    item.code === "broad_overlap_report_identity_mismatch"))
  const counts = structuredClone(report)
  counts.counts.rows += 1
  assert(validateBroadSchemaOverlapReport(counts, reportSchema).some((item) =>
    item.code === "broad_overlap_report_count_mismatch"))
  const order = structuredClone(report)
  order.rows.reverse()
  assert(validateBroadSchemaOverlapReport(order, reportSchema).some((item) =>
    item.code === "broad_overlap_report_noncanonical"))
  const digest = structuredClone(report)
  digest.report_digest = "0".repeat(64)
  assert(validateBroadSchemaOverlapReport(digest, reportSchema).some((item) =>
    item.code === "broad_overlap_report_digest_mismatch"))
})
test("unavailable upstream ratchet base emits no report artifact", () => {
  const result = spawnSync(process.execPath, [join(
    workspaceRoot, "scripts", "generate_broad_schema_overlap_report.ts",
  ), fixture.revision, "refs/heads/does-not-exist"], {
    cwd: workspaceRoot, encoding: "utf8",
  })
  assert.notEqual(result.status, 0)
  assert.equal(result.stdout, "")
  assert.match(result.stderr, /ratchet_baseline_unavailable/)
})
