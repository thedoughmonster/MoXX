import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("links coverage evidence to the exact job and pagination generation", async () => {
  const sourceRoot = new URL("../src/", import.meta.url)
  const names = [
    "registry_types.ts",
    "claim_job.ts",
    "begin_attempt.ts",
    "record_coverage.ts",
    "record_failure_coverage.ts",
  ]
  const [types, claim, begin, success, failure] = await Promise.all(
    names.map((name) => readFile(new URL(name, sourceRoot), "utf8")),
  )

  assert.match(types, /coverage_policy_version: string/)
  assert.match(types, /pagination_generation: number/)
  assert.match(claim, /claimed\.coverage_policy_version/)
  assert.match(claim, /claimed\.pagination_generation/)
  assert.match(begin, /request_cursor,\s*pagination_generation,/)
  assert.match(begin, /job\.pagination_generation/)

  for (const source of [success, failure]) {
    assert.match(source, /job_id,/)
    assert.match(source, /coverage_policy_version/)
    assert.match(source, /coverage_dimensions/)
    assert.match(source, /terminal_attempt_id/)
    assert.match(source, /pagination_generation/)
    assert.match(source, /job\.job_id/)
    assert.match(source, /job\.parameters/)
  }
  assert.match(success, /order by started_at desc, attempt_id desc limit 1/)
  assert.match(failure, /array_agg\(attempt\.attempt_id order by attempt\.started_at desc\)/)
})
