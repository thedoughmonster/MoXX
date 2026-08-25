import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { evaluateDryRunThresholds } from "./evaluate_dry_run_thresholds.ts"
import { parseResourceBaselineOutput } from "./parse_resource_baseline_output.ts"
import { parseResourceQueryOutput } from "./parse_resource_query_output.ts"
import {
  VALID_RESOURCE_BASELINE,
  VALID_RESOURCE_QUERY_SAMPLE,
} from "./query_sample_fixtures.test_fixture.ts"
import {
  MAX_GUARD_RUNS,
} from "./sample_constants.ts"
import {
  VALID_FAST_SAMPLE,
  VALID_RESOURCE_SAMPLE,
} from "./sample_fixtures.test_fixture.ts"
import { VALID_WORK_BASELINE } from "./work_baseline.test_fixture.ts"
import {
  FAST_SQL_FILENAME,
  RESOURCE_SQL_FILENAME,
  RESOURCE_SQL_MARKER,
  SQL_ARTIFACT_DIRECTORY,
} from "./sql_artifact_constants.ts"

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "../..")
const bytes = (sample: unknown) => Buffer.from(`${JSON.stringify([{
  marker: RESOURCE_SQL_MARKER, schema_version: 1, sample,
}], null, 2)}\n`)

test("pre-guard baseline captures the maximum Cron run ID and rejects a guard", () => {
  const raw = {
    ...VALID_RESOURCE_QUERY_SAMPLE, guardIdentityCount: 0, guardJobId: 0,
    guardRunCount: 0, guardFailureCount: 0,
  }
  assert.deepEqual(parseResourceBaselineOutput(bytes(raw)), {
    maxCronRunId: raw.currentMaxRunId, databaseBytes: raw.databaseBytes,
    cronHistoryBytes: raw.cronHistoryBytes, deadlocks: raw.deadlocks,
  })
  assert.throws(() => parseResourceBaselineOutput(bytes(VALID_RESOURCE_QUERY_SAMPLE)))
})

test("a target run and failure after baseline remain terminal at second 300", () => {
  const sample = parseResourceQueryOutput(bytes({
    ...VALID_RESOURCE_QUERY_SAMPLE,
    observedAtUtcMs: VALID_RESOURCE_QUERY_SAMPLE.observedAtUtcMs + 300_000,
    currentMaxRunId: 1_300, maximumTargetRunId: 1_001,
    maximumTargetFailureRunId: 1_001,
  }), VALID_RESOURCE_BASELINE)
  assert.equal(sample.targetRunCount, 1)
  assert.equal(sample.targetRunFailures, 1)
  assert.ok(evaluateDryRunThresholds(VALID_FAST_SAMPLE, VALID_WORK_BASELINE, sample)
    .includes("target_execution_present"))
})

test("target evidence includes legacy projection ID 4 in both sealed queries", () => {
  for (const filename of [FAST_SQL_FILENAME, RESOURCE_SQL_FILENAME]) {
    const sql = readFileSync(join(sourceRoot, SQL_ARTIFACT_DIRECTORY, filename), "utf8")
    assert.match(sql, /r\.jobid in \(2, 3, 4, 11\)/)
  }
})

test("unrelated Cron growth does not become guard-attributed growth", () => {
  const resource = parseResourceQueryOutput(bytes({
    ...VALID_RESOURCE_QUERY_SAMPLE,
    cronHistoryBytes: VALID_RESOURCE_BASELINE.cronHistoryBytes + 10_000_000,
    guardRunCount: 2,
  }), VALID_RESOURCE_BASELINE)
  assert.equal(resource.cronHistoryGrowthBytes, 10_000_000)
  assert.equal(resource.guardCronHistoryEstimatedBytes, 8_192)
})

test("exactly 828 guard rows pass the row gate and row 829 stops", () => {
  const boundary = { ...VALID_RESOURCE_SAMPLE, guardRunCount: MAX_GUARD_RUNS }
  assert.doesNotMatch(evaluateDryRunThresholds(
    VALID_FAST_SAMPLE, VALID_WORK_BASELINE, boundary,
  ).join(","),
    /guard_run_limit_exceeded/)
  assert.ok(evaluateDryRunThresholds(VALID_FAST_SAMPLE, VALID_WORK_BASELINE, {
    ...boundary, guardRunCount: MAX_GUARD_RUNS + 1,
  }).includes("guard_run_limit_exceeded"))
})

test("four unrelated running jobs plus the guard pass; five unrelated jobs stop", () => {
  const four = { ...VALID_FAST_SAMPLE, activeCronExecutions: 5,
    nonTargetNonGuardActiveExecutions: 4 }
  assert.deepEqual(evaluateDryRunThresholds(four, VALID_WORK_BASELINE), [])
  const five = { ...four, activeCronExecutions: 6, nonTargetNonGuardActiveExecutions: 5 }
  assert.ok(evaluateDryRunThresholds(five, VALID_WORK_BASELINE)
    .includes("preactivation_cron_limit_exceeded"))
  const sql = readFileSync(join(sourceRoot, SQL_ARTIFACT_DIRECTORY, FAST_SQL_FILENAME), "utf8")
  assert.match(sql, /x\.jobid not in \(2, 3, 4, 11\)/)
  assert.match(sql, /x\.jobid = g\.jobid/)
})
