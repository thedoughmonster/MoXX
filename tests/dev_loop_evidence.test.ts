import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("records static before/after economy without fabricated timing", async () => {
  const evidence = JSON.parse(
    await readFile("docs/development-loop-evidence.json", "utf8"),
  )
  const comparison = evidence.representative_repository_only_dev_and_prod
  assert.equal(comparison.before.full_suite_count, 8)
  assert.equal(comparison.after.full_suite_count, 0)
  assert.equal(comparison.before.function_deployment_targets, 42)
  assert.equal(comparison.after.function_deployment_targets, 0)
  assert.equal(evidence.wall_time_evidence.legacy_final_seconds, null)
  assert.equal(evidence.wall_time_evidence.replacement_final_seconds, null)
  assert.match(evidence.wall_time_evidence.reason, /no timestamps/)
  assert.equal(
    evidence.context_evidence.estimated_success_log_context_reduction_percent,
    100,
  )
  assert.equal(evidence.context_evidence.scope, "successful command log bodies only")
})
