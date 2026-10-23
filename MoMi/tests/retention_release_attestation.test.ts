import assert from "node:assert/strict"
import test from "node:test"
import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { hashText } from "../scripts/dev_loop/hash_text.ts"
import { approveRetention } from "../scripts/release/retention/approval.ts"
import { retentionApprovalFixture } from "./fixtures/retention_release_approval.ts"

test("requires exact owner-reported project/name presence without credential metadata", () => {
  for (const environment of ["dev", "prod"] as const) {
    const { approval, context } = retentionApprovalFixture(environment)
    assert.deepEqual(approveRetention(approval, context).metrics_secret_attestation,
      approval.metrics_secret_attestation)
    for (const invalid of [null, {}, [],
      { ...approval.metrics_secret_attestation, environment: "other" },
      { ...approval.metrics_secret_attestation, project_ref: "wrong-project" },
      { ...approval.metrics_secret_attestation, name: "OTHER_SECRET" },
      { ...approval.metrics_secret_attestation, owner: "someone-else" },
      { ...approval.metrics_secret_attestation, method: "cli_listing" },
      { ...approval.metrics_secret_attestation, present: false },
      { ...approval.metrics_secret_attestation, present: "true" }]) {
      const changed = { ...approval, metrics_secret_attestation: invalid }
      assert.throws(() => approveRetention(changed,
        { ...context, approval_sha256: hashText(canonicalJson(changed)) }))
    }
    for (const field of ["value", "digest", "hash", "length", "prefix"]) {
      const changed = { ...approval, metrics_secret_attestation:
        { ...approval.metrics_secret_attestation, [field]: "FORBIDDEN_METADATA_SENTINEL" } }
      assert.throws(() => approveRetention(changed,
        { ...context, approval_sha256: hashText(canonicalJson(changed)) }), (error: unknown) => {
        assert.match(String(error), /attestation fields/)
        assert.doesNotMatch(String(error), /FORBIDDEN_METADATA_SENTINEL/)
        return true
      })
    }
  }
})

test("rejects missing, inherited and non-data attestations without reading their properties", () => {
  const { approval, context } = retentionApprovalFixture()
  const missing = { ...approval } as Record<string, unknown>
  delete missing.metrics_secret_attestation
  assert.throws(() => approveRetention(missing,
    { ...context, approval_sha256: hashText(canonicalJson(missing)) }), /approval fields/)
  const withGetter = Object.defineProperty({ ...approval.metrics_secret_attestation }, "name",
    { get: () => { throw new Error("FORBIDDEN_VALUE_READ") } })
  for (const value of [Object.create(approval.metrics_secret_attestation), withGetter]) {
    assert.throws(() => approveRetention({ ...approval, metrics_secret_attestation: value }, context),
      (error: unknown) => !String(error).includes("FORBIDDEN_VALUE_READ"))
  }
})

test("rejects stale, future and malformed observations and windows extended beyond observation", () => {
  for (const observed_at of ["2026-10-21T11:59:59Z", "2026-10-22T12:00:01Z",
    "2026-10-22T17:00:00Z", "2026-10-22T11:59:59Z", "2026-02-30T12:00:00Z", "2026-10-22", null]) {
    const { approval, context } = retentionApprovalFixture()
    Object.assign(approval.metrics_secret_attestation, { observed_at })
    context.approval_sha256 = hashText(canonicalJson(approval))
    assert.throws(() => approveRetention(approval, context))
  }
})

test("binds attestation in protected approval and rechecks freshness at each mutation boundary", () => {
  const { approval, context } = retentionApprovalFixture()
  approval.metrics_secret_attestation.observed_at = "2026-10-22T11:59:00Z"
  approval.expires_at = "2026-10-23T11:59:00Z"
  assert.throws(() => approveRetention(approval, context), /protected approval hash mismatch/)
  context.approval_sha256 = hashText(canonicalJson(approval))
  assert.doesNotThrow(() => approveRetention(approval, context))
  assert.doesNotThrow(() => approveRetention(approval,
    { ...context, now: Date.parse("2026-10-23T11:58:59.999Z") }))
  assert.throws(() => approveRetention(approval,
    { ...context, now: Date.parse("2026-10-23T11:59:00Z") }))
})
