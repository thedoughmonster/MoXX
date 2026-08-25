import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"
import { validateExecutionAuthority } from "../scripts/architecture/validate_execution_authority.ts"
import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { runGit } from "../scripts/dev_loop/run_git.ts"
import { loadLegacyDebtExclusionCase } from "./legacy_debt_exclusion_test_support.ts"
const subject = await loadLegacyDebtExclusionCase()
test("legacy debt stays removal-only at the current authority boundary", async () => {
  assert.notEqual(subject.fixture.source_revision.commit, runGit(["rev-parse", "HEAD"]))
  const valid = await subject.verify()
  assert.deepEqual(valid.diagnostics, [])
  assert.deepEqual(valid.authority, [])
  assert.equal(valid.finding.fingerprint, subject.expectedFingerprint)
  assert.equal(valid.row.fingerprint, subject.expectedFingerprint)
  assert.deepEqual(valid.projection, subject.fixture.report.expected_projection)
  const positiveNamespaces = ["filesystem", "database", "contracts", "network",
    "secrets", "packages", "external"].map((key) => canonicalJson((subject.control as any)[key]))
  for (const material of [subject.expectedFingerprint, subject.fixture.baseline.path,
    subject.fixture.report.path, subject.fixture.report.report_digest, subject.fixture.report.findings_sha256,
    subject.fixture.baseline.sha256, subject.fixture.baseline.git_blob, subject.fixture.report.expected_projection.subject,
    subject.fixture.report.expected_projection.sql_source_hash, canonicalJson(valid.projection), canonicalJson(valid.row), "momi_alerting.order_alert_candidates"]) {
    assert.equal(positiveNamespaces.some((item) => item.includes(material)), false)
  }
  const negative = structuredClone(subject.control)
  negative.grant_id = "ea-mox-217-slack-order-delivery-negative"
  negative.database.read = [
    { owner_service: "order-alerting", object_kind: "table",
      qualified_object: "momi_alerting.order_alert_candidates" },
    ...negative.database.read,
  ]
  const rejected = await subject.verify(subject.fixture, negative)
  assert.deepEqual(rejected.authority.map((item) => [item.field_path, item.code, item.target]), [
    ["/database/read/0/owner_service", "cross_owner_target", "order-alerting"],
    ["/database/read/0", "debt_derived_authority", "momi_alerting.order_alert_candidates"],
  ])
  assert.equal(negative.database.read[1].qualified_object,
    "momi_alerting.slack_delivery_attempts")
  const reversed = structuredClone(negative)
  reversed.grant_id = "ea-mox-217-slack-order-delivery-reversed"
  reversed.database.read.reverse()
  const reversedResult = await subject.verify(subject.fixture, reversed)
  assert.deepEqual(reversedResult.authority.map((item) => [item.field_path, item.code, item.target]), [
    ["/database/read/1/owner_service", "cross_owner_target", "order-alerting"],
    ["/database/read/1", "debt_derived_authority", "momi_alerting.order_alert_candidates"],
    ["/database/read", "collection_unsorted", "/database/read"],
  ])
  const shape = structuredClone(subject.fixture)
  delete shape.fixture_id
  assert.equal((await subject.verify(shape)).diagnostics[0].field_path, "/fixture_id")
  const unknown = structuredClone(subject.fixture)
  unknown.unexpected = true
  assert.equal((await subject.verify(unknown)).diagnostics[0].field_path, "/unexpected")
  const nestedUnknown = structuredClone(subject.fixture)
  nestedUnknown.report.expected_projection.unexpected = true
  assert.equal((await subject.verify(nestedUnknown)).diagnostics[0].field_path, "/report/expected_projection/unexpected")
  const nestedWrongType = structuredClone(subject.fixture)
  nestedWrongType.baseline.sha256 = 1
  assert.equal((await subject.verify(nestedWrongType)).diagnostics[0].field_path, "/baseline/sha256")
  const nestedMissing = structuredClone(subject.fixture)
  delete nestedMissing.report.expected_projection.object.identity
  assert.equal((await subject.verify(nestedMissing)).diagnostics[0].field_path, "/report/expected_projection/object/identity")
  const combined = structuredClone(subject.fixture)
  delete combined.fixture_id
  combined.report.expected_projection.unexpected = true
  combined.baseline.sha256 = 1
  assert.deepEqual((await subject.verify(combined)).diagnostics.map((item) => item.field_path), [
    "/baseline/sha256", "/fixture_id", "/report/expected_projection/unexpected",
  ])
  const digestDrift = structuredClone(subject.fixture)
  digestDrift.fixture_digest = "0000000000000000000000000000000000000000000000000000000000000000"
  assert.deepEqual((await subject.verify(digestDrift)).diagnostics.map((item) =>
    [item.field_path, item.code, item.target]), [[
      "/fixture_digest", "debt_exclusion_source_identity_mismatch", "fixture_digest",
    ]])
  for (const [field, length] of [["commit", 40], ["tree", 40]] as const) {
    const sourceDrift = structuredClone(subject.fixture)
    sourceDrift.source_revision[field] = "0".repeat(length)
    const { fixture_digest: _digest, ...withoutDigest } = sourceDrift
    sourceDrift.fixture_digest = createHash("sha256").update(
      canonicalJson(withoutDigest)).digest("hex")
    assert.deepEqual((await subject.verify(sourceDrift)).diagnostics, [{
      fixture_id: subject.fixture.fixture_id, field_path: `/source_revision/${field}`,
      code: "debt_exclusion_source_identity_mismatch", target: `source_revision.${field}`,
    }])
  }
  const fingerprintDrift = structuredClone(subject.fixture)
  fingerprintDrift.baseline.finding_fingerprint =
    "sha256:0000000000000000000000000000000000000000000000000000000000000000"
  { const { fixture_digest: _digest, ...withoutDigest } = fingerprintDrift
    fingerprintDrift.fixture_digest = createHash("sha256").update(
      canonicalJson(withoutDigest)).digest("hex") }
  assert.equal((await subject.verify(fingerprintDrift)).diagnostics[0].code,
    "debt_exclusion_finding_missing")
  const baselineMutation = structuredClone(subject.baseline)
  baselineMutation.notes[0] += " content mutation"
  const baselineDrift = await subject.verify(subject.fixture, subject.control, { baseline: baselineMutation, baselineText: JSON.stringify(baselineMutation), report: subject.report })
  const baselineDriftKeys = baselineDrift.diagnostics.map((item) => [item.fixture_id, item.field_path, item.code, item.target].join("\0")); assert.equal(baselineDrift.diagnostics[0].field_path, "/baseline/git_blob")
  assert.deepEqual(baselineDriftKeys, [...baselineDriftKeys].sort())
  assert.equal(new Set(baselineDriftKeys).size, baselineDriftKeys.length)
  const reportMutation = structuredClone(subject.report)
  reportMutation.report_digest = "0000000000000000000000000000000000000000000000000000000000000000"
  assert.equal((await subject.verify(subject.fixture, subject.control, {
    baseline: subject.baseline, baselineText: subject.baselineText,
    report: reportMutation,
  })).diagnostics[0].field_path, "/report/report_digest")
  const duplicateBaseline = structuredClone(subject.baseline)
  duplicateBaseline.findings.push(structuredClone(duplicateBaseline.findings.find(
    (item: any) => item.fingerprint === subject.expectedFingerprint)))
  assert.equal((await subject.verify(subject.fixture, subject.control,
    { baseline: duplicateBaseline, baselineText: subject.baselineText,
      report: subject.report })).diagnostics[0].code,
    "debt_exclusion_finding_duplicate")
  const duplicateReport = structuredClone(subject.report)
  duplicateReport.findings.push(structuredClone(duplicateReport.findings.find(
    (item) => item.fingerprint === subject.expectedFingerprint)))
  assert.equal((await subject.verify(subject.fixture, subject.control,
    { baseline: subject.baseline, baselineText: subject.baselineText,
      report: duplicateReport })).diagnostics[0].code,
    "debt_exclusion_source_identity_mismatch")
  const missingControl = structuredClone(subject.control)
  missingControl.database.read = []
  assert.deepEqual((await subject.verify(subject.fixture, missingControl)).diagnostics.map(
    (item) => [item.field_path, item.code, item.target]), [[
      "/database/read/0", "debt_exclusion_positive_control_missing",
      "momi_alerting.slack_delivery_attempts",
    ]])
  const identityDrift = structuredClone(subject.control)
  identityDrift.base_revision = "0000000000000000000000000000000000000000"
  identityDrift.source_digest = "0000000000000000000000000000000000000000000000000000000000000000"
  const identityResult = await subject.verify(subject.fixture, identityDrift)
  assert(identityResult.authority.some((item) => item.code === "base_revision_drift"))
  assert(identityResult.authority.some((item) => item.code === "source_digest_drift"))
  const withReport = { ...subject.context, legacyAccessGovernanceReport: subject.report }
  const withoutReport = await validateExecutionAuthority(
    subject.control, subject.executionSchema, subject.context)
  const reportResult = await validateExecutionAuthority(
    subject.control, subject.executionSchema, withReport as any)
  assert.deepEqual(reportResult, withoutReport)
})
