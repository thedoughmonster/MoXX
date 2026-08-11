import assert from "node:assert/strict"
import test from "node:test"

import type { Architecture } from "../scripts/architecture/types.ts"
import { buildImpactPlan } from "../scripts/dev_loop/build_impact_plan.ts"

const architecture = {
  services: [
    { manifest: { service_key: "square-payment-acquisition" } },
    { manifest: { service_key: "toast-stock-ingest" } },
    { manifest: { service_key: "zero-test-service" } },
  ],
  functions: [{
    slug: "toast-stock-webhook-ingest-v1",
    service: { manifest: { service_key: "toast-stock-ingest" } },
  }],
} as unknown as Architecture

const baseTests = [
  "tests/dev_loop_determinism.test.ts",
  "tests/dev_loop_release_plan.test.ts",
  "tests/retired_development_protocol.test.ts",
]
const issueTests = [...baseTests,
  "tests/issue_tracking.test.ts",
  "tests/issue_triage_validation.test.ts",
  "tests/issue_triage_workflow.test.ts",
].sort()
const releaseTests = [...baseTests,
  "tests/deployment_authority.test.ts",
  "tests/deployment_credentials.test.ts",
  "tests/release_coordinator.test.ts",
  "tests/release_migration_gate.test.ts",
  "tests/validation_workflow_baseline.test.ts",
].sort()
const selectedTests = (paths: string[]) =>
  buildImpactPlan(paths, architecture, new Map())
    .iteration_checks[0].args.slice(1)
test("service runtime selects its owning service tests", () => {
  assert.ok(selectedTests([
    "services/square-payment-acquisition/src/map_square_status.ts",
  ]).includes("services/square-payment-acquisition/**/*.test.ts"))
})
test("function source and thin adapter select owner tests", () => {
  for (const path of [
    "services/toast-stock-ingest/functions/" +
      "toast-stock-webhook-ingest-v1/src/verify_toast_signature.ts",
    "supabase/functions/toast-stock-webhook-ingest-v1/index.ts",
  ]) {
    const tests = selectedTests([path])
    assert.ok(tests.includes("services/toast-stock-ingest/**/*.test.ts"), path)
    assert.ok(tests.includes(
      "supabase/functions/toast-stock-webhook-ingest-v1/**/*.test.ts",
    ), path)
  }
})
test("service-local test selects the complete service pattern", () => {
  assert.ok(selectedTests([
    "services/square-payment-acquisition/tests/acquire_square_payment.test.ts",
  ]).includes("services/square-payment-acquisition/**/*.test.ts"))
})

test("multiple owners remain sorted and deduplicated", () => {
  const tests = selectedTests([
    "services/toast-stock-ingest/src/stock.ts",
    "services/square-payment-acquisition/src/payment.ts",
    "supabase/functions/toast-stock-webhook-ingest-v1/index.ts",
  ])
  assert.deepEqual(tests, [...new Set(tests)].sort())
})

test("a zero-test owner receives a safe bounded pattern", () => {
  const plan = buildImpactPlan(
    ["services/zero-test-service/src/index.ts"], architecture, new Map(),
  )
  assert.ok(plan.iteration_checks[0].args.includes(
    "services/zero-test-service/**/*.test.ts",
  ))
  assert.equal(plan.final_gate.kind, "full")
})

test("path-scoped classes retain existing policy", () => {
  for (const path of [
    "docs/example.md",
    ".github/workflows/validate.yml",
    ".github/workflows/issue-triage.yml",
    "scripts/check_source_quality.ts",
  ]) {
    const plan = buildImpactPlan([path], architecture, new Map())
    assert.equal(plan.final_gate.kind, "path_scoped", path)
    assert.deepEqual(plan.release.services, [], path)
  }
})

test("root and special focused selections remain unchanged", () => {
  assert.deepEqual(selectedTests(["tests/example.test.ts"]),
    [...baseTests, "tests/example.test.ts"].sort())
  assert.deepEqual(
    selectedTests([".github/workflows/issue-triage.yml"]), issueTests,
  )
  for (const path of [
    ".github/workflows/validate.yml", "scripts/dev_loop/hash_text.ts",
  ]) assert.deepEqual(selectedTests([path]), releaseTests, path)
})

test("broad impact classes retain the full final gate", () => {
  const migration = "supabase/migrations/20260816000000_square.sql"
  const cases: [string, Map<string, string>][] = [
    ["services/square-payment-acquisition/src/status.ts", new Map()],
    ["workspace.json", new Map()],
    ["services/square-payment-acquisition/service.json", new Map()],
    [migration, new Map([[migration, "square-payment-acquisition"]])],
    ["unexpected.bin", new Map()],
  ]
  for (const [path, owners] of cases) {
    assert.equal(buildImpactPlan(
      [path], architecture, owners,
    ).final_gate.kind, "full", path)
  }
})
