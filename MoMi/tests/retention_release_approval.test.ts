import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { hashText } from "../scripts/dev_loop/hash_text.ts"
import { approveRetention } from "../scripts/release/retention/approval.ts"
import { retentionFunctionSlug, retentionMigrations } from "../scripts/release/retention/policy.ts"
import { retentionApprovalFixture } from "./fixtures/retention_release_approval.ts"

test("accepts bound dev/prod approvals, canonical ordering, and distinct validated PR heads", () => {
  for (const environment of ["dev", "prod"] as const) {
    const { approval, context } = retentionApprovalFixture(environment)
    assert.deepEqual(approveRetention(approval, context), approval)
    assert.deepEqual(approveRetention(Object.fromEntries(Object.entries(approval).reverse()), context), approval)
    approval.validation.head_sha = "b".repeat(40)
    context.approval_sha256 = hashText(canonicalJson(approval))
    assert.deepEqual(approveRetention(approval, context), approval)
    approval.before.versions = []
    approval.deferred_versions = []
    context.approval_sha256 = hashText(canonicalJson(approval))
    assert.deepEqual(approveRetention(approval, context), approval)
  }
})

test("pins only governor and exact current normalized migration bytes", async () => {
  assert.equal(retentionFunctionSlug, "momi-cron-history-governor-v1")
  assert.deepEqual(Object.keys(retentionMigrations), ["20260805081324", "20260805122000", "20261022172534"])
  for (const { file, sha256 } of Object.values(retentionMigrations)) {
    assert.equal(hashText((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha256)
  }
})

test("rejects unknown context, environments, source identity, and protected hash", () => {
  const { approval, context } = retentionApprovalFixture()
  for (const invalid of [null, [], {}, { ...context, extra: true },
    { ...context, environment: "staging" }, { ...context, environment: "prod" },
    { ...context, source_sha: "b".repeat(40) }, { ...context, source_sha: "A".repeat(40) },
    { ...context, approval_sha256: "0".repeat(64) }, { ...context, approval_sha256: null },
    { ...context, now: NaN }, { ...context, now: Infinity }, { ...context, now: "0" }]) {
    assert.throws(() => approveRetention(approval, invalid as typeof context))
  }
})

test("rejects missing, extra, inherited, or non-data fields at every object level", () => {
  const { approval, context } = retentionApprovalFixture("prod")
  for (const field of [null, "validation", "before", "dev_receipt", "metrics_runtime_selection"] as const) {
    const baseline = field ? approval[field]! : approval
    for (const key of [...Object.keys(baseline), "extra"]) {
      const changed = structuredClone(approval)
      const target = (field ? changed[field] : changed) as Record<string, unknown>
      if (key === "extra") target[key] = true
      else delete target[key]
      const protectedContext = { ...context, approval_sha256: hashText(canonicalJson(changed)) }
      assert.throws(() => approveRetention(changed, protectedContext), `${field}.${key}`)
    }
  }
  for (const invalid of [null, [], {}, Object.create(approval),
    { ...approval, [Symbol("extra")]: true },
    Object.defineProperty({ ...approval }, "kind", { enumerable: false }),
    Object.defineProperty({ ...approval }, "kind", { get: () => approval.kind })]) {
    assert.throws(() => approveRetention(invalid, context))
  }
})

test("rejects widened migration scope, malformed hashes and receipt types even when hash-bound", () => {
  const mutations: Array<[string, unknown]> = [
    ["schema_version", "1"], ["kind", "release"], ["environment", "dev"],
    ["project_ref", "another-project"], ["source_sha", "a".repeat(39)],
    ["function_source_sha256", "F".repeat(64)], ["function_source_sha256", 1],
    ["migrations", []], ["migrations", ["20261022172534"]],
    ["migrations", ["20261022172534", "20260805122000", "20260805081324"]],
    ["migrations", ["20260805081324", "20260805081324", "20261022172534"]],
    ["migrations", ["20260805081324", "20260805122000", "20261022172534", "20261022172535"]],
    ["migrations", "20261022172534"], ["dev_receipt", null],
  ]
  for (const [field, value] of mutations) {
    const { approval, context } = retentionApprovalFixture("prod")
    const changed = { ...approval, [field]: value }
    context.approval_sha256 = hashText(canonicalJson(changed))
    assert.throws(() => approveRetention(changed, context), field)
  }
  for (const field of ["validation", "before", "dev_receipt"] as const) {
    for (const key of Object.keys(retentionApprovalFixture("prod").approval[field]!)) {
      if (key === "versions") continue
      for (const bad of [null, "", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, {}, []]) {
        const { approval, context } = retentionApprovalFixture("prod")
        Object.assign(approval[field]!, { [key]: bad })
        context.approval_sha256 = hashText(canonicalJson(approval))
        assert.throws(() => approveRetention(approval, context), `${field}.${key}`)
      }
    }
  }
  const { approval, context } = retentionApprovalFixture()
  approval.dev_receipt = { run_id: 12, artifact_id: 21, run_attempt: 1, sha256: "1".repeat(64) }
  context.approval_sha256 = hashText(canonicalJson(approval))
  assert.throws(() => approveRetention(approval, context))
})

test("rejects overlapping, duplicate, unsorted or malformed retained and deferred versions", () => {
  for (const field of ["before", "deferred_versions"] as const) {
    for (const versions of [["20261022172534"], ["20260801000000", "20260801000000"],
      ["20260802000000", "20260801000000"], ["20260802000000"], ["invalid"], [1]]) {
      const { approval, context } = retentionApprovalFixture()
      if (field === "before") Object.assign(approval.before, { versions })
      else Object.assign(approval, { deferred_versions: versions })
      if (field === "deferred_versions" && versions[0] === "20260802000000" && versions.length === 1) {
        approval.before.versions = ["20260802000000"]
      }
      context.approval_sha256 = hashText(canonicalJson(approval))
      assert.throws(() => approveRetention(approval, context))
    }
  }
  const { approval, context } = retentionApprovalFixture()
  approval.before.versions = Object.assign(new Array(1), { extra: "20260801000000" })
  assert.throws(() => approveRetention(approval, context), /before versions/)
  approval.before.versions = Object.defineProperty(["20260801000000"], 0, { get: () => "20260801000000" })
  assert.throws(() => approveRetention(approval, context), /before versions/)
})

test("rejects future issuance, expired, oversized, invalid, and post-sunset windows", () => {
  for (const [issued_at, expires_at, now] of [
    ["2026-10-22T17:00:00Z", "2026-10-23T12:00:00Z", "2026-10-22T16:00:00Z"],
    ["2026-10-22T12:00:00Z", "2026-10-22T16:00:00Z", "2026-10-22T16:00:00Z"],
    ["2026-10-22T12:00:00Z", "2026-10-23T12:00:00.001Z", "2026-10-22T16:00:00Z"],
    ["2026-10-28T12:00:00Z", "2026-10-29T12:00:00Z", "2026-10-28T16:00:00Z"],
    ["2026-10-22", "2026-10-23T12:00:00Z", "2026-10-22T16:00:00Z"],
    ["2026-02-30T12:00:00Z", "2026-03-01T12:00:00Z", "2026-03-01T10:00:00Z"],
  ]) {
    const { approval, context } = retentionApprovalFixture()
    Object.assign(approval, { issued_at, expires_at })
    Object.assign(context, { now: Date.parse(now), approval_sha256: hashText(canonicalJson(approval)) })
    assert.throws(() => approveRetention(approval, context), `${issued_at}/${expires_at}`)
  }
  const { approval, context } = retentionApprovalFixture()
  Object.assign(approval, { issued_at: "2026-10-28T00:00:00Z", expires_at: "2026-10-29T00:00:00Z" })
  approval.metrics_runtime_selection.selected_at = approval.issued_at
  Object.assign(context, { now: Date.parse(approval.issued_at), approval_sha256: hashText(canonicalJson(approval)) })
  assert.deepEqual(approveRetention(approval, context), approval)
  assert.throws(() => approveRetention(approval, { ...context, now: Date.parse(approval.expires_at) }))
})
