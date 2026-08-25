import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { createRecoveryPreflightFailure } from "./create_recovery_preflight_failure.ts"
import { initializeReceipt } from "./initialize_receipt.ts"
import { recordRecoveryPreflightFailure } from "./record_recovery_preflight_failure.ts"
import { RECOVERY_PREFLIGHT_REASON_CATEGORIES } from "./recovery_preflight_failure_types.ts"

test("every preflight reason category is permanent and sanitized", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-preflight-reason-"))
  try {
    for (const [index, reasonCategory] of RECOVERY_PREFLIGHT_REASON_CATEGORIES.entries()) {
      const runId = `run-${index.toString(16).padStart(24, "0")}`
      const receipt = await initializeReceipt(root, runId)
      const invariant = ["work", "control", "cohort", "routes", "safety"]
        .includes(reasonCategory)
      const failure = createRecoveryPreflightFailure({ reasonCategory,
        stage: invariant ? "invariant_validation" :
          reasonCategory === "parse_schema" ? "parse_schema" : "provider_query",
        durationMs: index, querySha256: "a".repeat(64),
        ...(invariant ? { invariantGroups: { work: reasonCategory === "work",
          control: reasonCategory === "control", cohort: reasonCategory === "cohort",
          routes: reasonCategory === "routes", safety: reasonCategory === "safety" } } : {}),
      })
      const state = { receipt, runId, runtime: { options: {
        projectRef: "xtbraqnlskmqxinjxxdn" }, repository: {
        headSha: "b".repeat(40) } } } as never
      const artifact = await recordRecoveryPreflightFailure(state, failure)
      const text = await readFile(artifact.path, "utf8")
      const parsed = JSON.parse(text)
      assert.equal(parsed.reason_category, reasonCategory)
      assert.equal(parsed.terminal_class, "PRE_GUARD_FAILURE")
      assert.equal(parsed.failure_fingerprint, failure.failureFingerprint)
      assert.equal(text.includes("private provider output"), false)
      assert.equal(text.includes("select "), false)
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})
