import assert from "node:assert/strict"
import test from "node:test"

import { finalizeFindings } from
  "../scripts/constitution/finalize_findings.ts"
import { findBaselineViolations } from
  "../scripts/constitution/find_baseline_violations.ts"
import type {
  ConstitutionBaseline,
  ConstitutionFinding,
} from "../scripts/constitution/types.ts"

const current = finalizeFindings([{
  rule_version: 1,
  rule_id: "service_type_missing",
  subject: "services/communications-archive/service.json",
  evidence: { service_key: "communications-archive" },
  summary: "Current diagnostic wording.",
}])[0]
const targetBaselineFingerprints = new Set([current.fingerprint])

function baseline(findings: ConstitutionFinding[]): ConstitutionBaseline {
  return {
    $schema: "https://momi.local/schemas/service-constitution-debt-baseline-v1.schema.json",
    schema_version: 1,
    generated_from: "dev@8c6eb4f",
    notes: ["Synthetic exact constitution baseline fixture."],
    findings,
  }
}

test("matches canonical identity despite summary churn", () => {
  const allowed = { ...current, summary: "Older diagnostic wording." }
  assert.deepEqual(
    findBaselineViolations(
      [current], baseline([allowed]), targetBaselineFingerprints,
    ),
    [],
  )
})

test("rejects duplicate baseline identities despite summary churn", () => {
  const duplicate = { ...current, summary: "Different summary." }
  assert.match(
    findBaselineViolations(
      [current], baseline([current, duplicate]), targetBaselineFingerprints,
    ).join("\n"),
    /duplicate baseline finding identity/,
  )
})

test("rejects duplicate current finding identities", () => {
  assert.match(
    findBaselineViolations(
      [current, current], baseline([current]), targetBaselineFingerprints,
    ).join("\n"),
    /duplicate current finding identity/,
  )
})

test("rejects a stale resolved baseline entry", () => {
  assert.match(
    findBaselineViolations(
      [], baseline([current]), targetBaselineFingerprints,
    ).join("\n"),
    /stale baseline service_type_missing/,
  )
})

test("rejects recurrence after the baseline entry is removed", () => {
  assert.match(
    findBaselineViolations(
      [current], baseline([]), targetBaselineFingerprints,
    ).join("\n"),
    /new service_type_missing/,
  )
})

test("rejects re-adding an exemption removed from the target baseline", () => {
  assert.match(
    findBaselineViolations([current], baseline([current]), new Set()).join("\n"),
    /baseline identity was not present on origin\/dev/,
  )
})

test("rejects changing the evidence of an existing exemption", () => {
  const changed = finalizeFindings([{
    ...current,
    evidence: { ...current.evidence, changed_authority: "yes" },
  }])[0]
  assert.match(
    findBaselineViolations([changed], baseline([changed]), targetBaselineFingerprints)
      .join("\n"),
    /baseline identity was not present on origin\/dev/,
  )
})

test("rejects a malformed stored fingerprint", () => {
  const malformed = { ...current, fingerprint: `sha256:${"0".repeat(64)}` }
  assert.match(
    findBaselineViolations(
      [current], baseline([malformed]), targetBaselineFingerprints,
    ).join("\n"),
    /baseline fingerprint must be/,
  )
})
