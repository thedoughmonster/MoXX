import assert from "node:assert/strict"
import test from "node:test"
import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { hashText } from "../scripts/dev_loop/hash_text.ts"
import { approveRetention } from "../scripts/release/retention/approval.ts"
import { retentionApprovalFixture } from "./fixtures/retention_release_approval.ts"

test("requires exact owner-selected runtime source and key for the target project", () => {
  for (const environment of ["dev", "prod"] as const) {
    const { approval, context } = retentionApprovalFixture(environment)
    assert.deepEqual(approveRetention(approval, context).metrics_runtime_selection,
      approval.metrics_runtime_selection)
    for (const invalid of [null, {}, [],
      { ...approval.metrics_runtime_selection, environment: "other" },
      { ...approval.metrics_runtime_selection, project_ref: "wrong-project" },
      { ...approval.metrics_runtime_selection, source: "SUPABASE_SERVICE_ROLE_KEY" },
      { ...approval.metrics_runtime_selection, source: "MOMI_CRON_HISTORY_METRICS_SECRET_KEY" },
      { ...approval.metrics_runtime_selection, key: "other" },
      { ...approval.metrics_runtime_selection, owner: "someone-else" },
      { ...approval.metrics_runtime_selection, method: "owner_dashboard_names_only" }]) {
      const changed = { ...approval, metrics_runtime_selection: invalid }
      assert.throws(() => approveRetention(changed,
        { ...context, approval_sha256: hashText(canonicalJson(changed)) }))
    }
    for (const field of ["value", "digest", "hash", "length", "prefix", "present", "verified"]) {
      const changed = { ...approval, metrics_runtime_selection:
        { ...approval.metrics_runtime_selection, [field]: "FORBIDDEN_METADATA_SENTINEL" } }
      assert.throws(() => approveRetention(changed,
        { ...context, approval_sha256: hashText(canonicalJson(changed)) }), (error: unknown) => {
        assert.match(String(error), /selection fields/)
        assert.doesNotMatch(String(error), /FORBIDDEN_METADATA_SENTINEL/)
        return true
      })
    }
  }
})

test("rejects missing, legacy, inherited and accessor selection records", () => {
  const { approval, context } = retentionApprovalFixture()
  const missing = { ...approval } as Record<string, unknown>
  delete missing.metrics_runtime_selection
  for (const value of [missing, { ...missing, metrics_secret_attestation: {
    environment: approval.environment, project_ref: approval.project_ref,
    name: "MOMI_CRON_HISTORY_METRICS_SECRET_KEY", present: true,
    owner: "Zac", method: "owner_dashboard_names_only", observed_at: approval.issued_at,
  } }]) {
    assert.throws(() => approveRetention(value,
      { ...context, approval_sha256: hashText(canonicalJson(value)) }), /approval fields/)
  }
  const getter = Object.defineProperty({ ...approval.metrics_runtime_selection }, "source",
    { get: () => { throw new Error("FORBIDDEN_VALUE_READ") } })
  for (const value of [Object.create(approval.metrics_runtime_selection), getter]) {
    assert.throws(() => approveRetention({ ...approval, metrics_runtime_selection: value }, context),
      (error: unknown) => !String(error).includes("FORBIDDEN_VALUE_READ"))
  }
})

test("rejects stale, future, malformed selections and windows beyond selection freshness", () => {
  for (const selected_at of ["2026-10-21T11:59:59Z", "2026-10-22T12:00:01Z",
    "2026-10-22T17:00:00Z", "2026-10-22T11:59:59Z", "2026-02-30T12:00:00Z", "2026-10-22", null]) {
    const { approval, context } = retentionApprovalFixture()
    Object.assign(approval.metrics_runtime_selection, { selected_at })
    context.approval_sha256 = hashText(canonicalJson(approval))
    assert.throws(() => approveRetention(approval, context))
  }
})

test("binds the source selection in protected approval and rechecks it at mutation boundaries", () => {
  const { approval, context } = retentionApprovalFixture()
  approval.metrics_runtime_selection.selected_at = "2026-10-22T11:59:00Z"
  approval.expires_at = "2026-10-23T11:59:00Z"
  assert.throws(() => approveRetention(approval, context), /protected approval hash mismatch/)
  context.approval_sha256 = hashText(canonicalJson(approval))
  assert.doesNotThrow(() => approveRetention(approval, context))
  assert.doesNotThrow(() => approveRetention(approval,
    { ...context, now: Date.parse("2026-10-23T11:58:59.999Z") }))
  assert.throws(() => approveRetention(approval,
    { ...context, now: Date.parse("2026-10-23T11:59:00Z") }))
})
