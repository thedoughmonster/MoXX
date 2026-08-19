import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { readJson } from "../scripts/architecture/read_json.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { buildLegacyAccessGovernanceReport } from
  "../scripts/constitution/build_legacy_access_governance_report.ts"
import { fingerprintFinding } from
  "../scripts/constitution/fingerprint_finding.ts"
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
const trusted = new Set<string>(happySource.findings.map(
  (finding: { fingerprint: string }) => finding.fingerprint,
))
const happy = buildLegacyAccessGovernanceReport({
  sourceText: happyText, sourceSchema, trustedFingerprints: trusted,
})

for (const [name, code, fingerprints] of [
  ["invalid-json.json", "legacy_report_source_json_invalid", []],
  ["unsupported-rule.json", "legacy_report_finding_kind_unsupported", []],
  ["incomplete-relation.json", "legacy_report_known_variant_incomplete",
    ["sha256:5a321f055971f29456acfbdceed3a70fd638674bd015736a03d2e808ad63675a"]],
] as const) {
  test(`fails closed for ${name}`, async () => {
    const sourceText = await readFile(join(fixtureRoot, name), "utf8")
    assert.throws(() => buildLegacyAccessGovernanceReport({
      sourceText, sourceSchema, trustedFingerprints: new Set(fingerprints),
    }), new RegExp(code))
  })
}

test("rejects versions, duplicate identities, and unknown access", () => {
  const version = structuredClone(happySource)
  version.schema_version = 2
  assert.throws(() => buildLegacyAccessGovernanceReport({
    sourceText: JSON.stringify(version), sourceSchema, trustedFingerprints: trusted,
  }), /legacy_report_source_version_unsupported/)
  const duplicate = structuredClone(happySource)
  duplicate.findings.splice(1, 0, structuredClone(duplicate.findings[0]))
  assert.throws(() => buildLegacyAccessGovernanceReport({
    sourceText: JSON.stringify(duplicate), sourceSchema,
    trustedFingerprints: trusted,
  }), /legacy_report_fingerprint_duplicate/)
  const access = structuredClone(happySource)
  access.findings[0].evidence.access = "execute"
  access.findings[0].fingerprint = fingerprintFinding(access.findings[0])
  assert.throws(() => buildLegacyAccessGovernanceReport({
    sourceText: JSON.stringify(access), sourceSchema,
    trustedFingerprints: new Set([...trusted, access.findings[0].fingerprint]),
  }), /legacy_report_access_mode_unsupported/)
})

test("rejects schema, provenance, set, count, order, and digest drift", () => {
  const authority = { ...structuredClone(happy), grant: true }
  assert.throws(() => validateLegacyAccessGovernanceReport(
    authority as typeof happy, reportSchema, happy,
  ), /legacy_report_known_variant_incomplete/)
  const provenance = structuredClone(happy)
  provenance.source.path = "docs/another.json" as typeof provenance.source.path
  assert.throws(() => validateLegacyAccessGovernanceReport(
    provenance, reportSchema, happy,
  ), /legacy_report_known_variant_incomplete|legacy_report_provenance_incomplete/)
  const set = structuredClone(happy)
  set.findings.pop()
  assert.throws(() => validateLegacyAccessGovernanceReport(
    set, reportSchema, happy,
  ), /legacy_report_fingerprint_set_mismatch/)
  const count = structuredClone(happy)
  count.source.finding_count += 1
  assert.throws(() => validateLegacyAccessGovernanceReport(
    count, reportSchema, count,
  ), /legacy_report_count_mismatch/)
  const order = structuredClone(happy)
  order.findings.reverse()
  assert.throws(() => validateLegacyAccessGovernanceReport(
    order, reportSchema, order,
  ), /legacy_report_finding_identity_invalid/)
  const digest = structuredClone(happy)
  digest.report_digest = "0".repeat(64)
  assert.throws(() => validateLegacyAccessGovernanceReport(
    digest, reportSchema, digest,
  ), /legacy_report_digest_mismatch/)
})
