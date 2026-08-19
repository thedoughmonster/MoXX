import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { readJson } from "../scripts/architecture/read_json.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { buildLegacyAccessGovernanceReport } from
  "../scripts/constitution/build_legacy_access_governance_report.ts"
import { loadTargetAccessBaselineFingerprints } from
  "../scripts/constitution/load_target_access_baseline_fingerprints.ts"
import { renderLegacyAccessGovernanceReport } from
  "../scripts/constitution/render_legacy_access_governance_report.ts"
import { validateLegacyAccessGovernanceReport } from
  "../scripts/constitution/validate_legacy_access_governance_report.ts"

const fixtureRoot = join(
  workspaceRoot, "tests", "fixtures", "legacy-access-governance-report",
)
const sourceSchema = await readJson<object>(join(
  workspaceRoot, "schemas", "service-access-debt-baseline-v1.schema.json",
))
const reportSchema = await readJson<object>(join(
  workspaceRoot, "schemas", "legacy-access-governance-report-v1.schema.json",
))
const happyText = await readFile(join(fixtureRoot, "happy-path.json"), "utf8")
const happySource = JSON.parse(happyText)
const happyTrusted = new Set<string>(happySource.findings.map(
  (finding: { fingerprint: string }) => finding.fingerprint,
))
const happy = buildLegacyAccessGovernanceReport({
  sourceText: happyText, sourceSchema, trustedFingerprints: happyTrusted,
})

test("projects the four exact variants without inferred authority", () => {
  validateLegacyAccessGovernanceReport(happy, reportSchema, happy)
  assert.equal(happy.findings.length, 4)
  assert.deepEqual(happy.source.rule_counts, {
    direct_private_relation_access: 1,
    direct_private_routine_call: 1,
    dynamic_event_name: 1,
    dynamic_relation_identifier: 1,
  })
  const routine = happy.findings.find((row) =>
    row.rule_id === "direct_private_routine_call")!
  assert.equal(routine.access_mode, "call")
  assert.equal(routine.access_mode_basis, "direct_private_routine_call/v1")
  for (const row of happy.findings.filter((finding) =>
    finding.rule_id.startsWith("dynamic_"))) {
    assert.equal(row.access_projection, "unavailable_from_source")
    assert.equal(row.consumer_service, undefined)
    assert.equal(row.object, undefined)
  }
  assert.equal(JSON.stringify(happy).includes("summary"), false)
  assert.notEqual(happy.findings[2].fingerprint, happy.findings[3].fingerprint)
})

test("summary churn does not change projected findings identity", () => {
  const changed = structuredClone(happySource)
  changed.findings[0].summary = "Changed non-identity summary prose."
  const report = buildLegacyAccessGovernanceReport({
    sourceText: `${JSON.stringify(changed, null, 2)}\n`, sourceSchema,
    trustedFingerprints: happyTrusted,
  })
  assert.equal(report.findings_sha256, happy.findings_sha256)
  assert.notEqual(report.source.sha256, happy.source.sha256)
})

test("checked-in artifact is the exact current 133-row projection", async () => {
  const sourceText = await readFile(join(
    workspaceRoot, "docs", "service-access-debt-baseline.json",
  ), "utf8")
  const report = buildLegacyAccessGovernanceReport({ sourceText, sourceSchema,
    trustedFingerprints: loadTargetAccessBaselineFingerprints() })
  const artifactText = await readFile(join(
    workspaceRoot, "docs", "legacy-access-governance-report.json",
  ), "utf8")
  assert.equal(report.source.git_blob, "ff1769ab6dd2fde77f101e65832341b4e0bf334f")
  assert.equal(report.source.sha256,
    "ee71cd2cbe0245fc8eb4091ff5d2e0603e2134f17e96380b8e07ec799f467788")
  assert.equal(report.source.finding_count, 133)
  assert.equal(artifactText, renderLegacyAccessGovernanceReport(report))
  validateLegacyAccessGovernanceReport(
    JSON.parse(artifactText), reportSchema, report,
  )
})
