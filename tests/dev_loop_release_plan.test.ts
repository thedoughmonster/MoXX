import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import type { Architecture } from "../scripts/architecture/types.ts"
import { buildImpactPlan } from "../scripts/dev_loop/build_impact_plan.ts"
import type { BoundPlan, ValidationReceipt } from "../scripts/dev_loop/types.ts"
import { buildReleaseReceipt } from
  "../scripts/release/build_release_receipt.ts"
import { requiredJobState } from "../scripts/release/required_job_state.ts"

const architecture = {
  services: [
    { manifest: { service_key: "alpha" } },
    { manifest: { service_key: "beta" } },
  ],
  functions: [
    { slug: "alpha-v1", service: { manifest: { service_key: "alpha" } } },
    { slug: "beta-v1", service: { manifest: { service_key: "beta" } } },
  ],
} as unknown as Architecture

test("repository-only plans use a path gate and deploy nothing", () => {
  const plan = buildImpactPlan(
    ["docs/deployment.md", "scripts/dev_loop/hash_text.ts"],
    architecture,
    new Map(),
  )
  assert.equal(plan.final_gate.kind, "path_scoped")
  assert.equal(plan.release.database, "none")
  assert.deepEqual(plan.release.services, [])
  assert.deepEqual(plan.release.functions, [])
})

test("repository plans do not execute intentionally retired tests", () => {
  const retired = "tests/intentionally_retired.test.ts"
  const plan = buildImpactPlan([retired], architecture, new Map())
  assert.ok(!plan.iteration_checks[0]?.args.includes(retired))
})

test("runtime plans deploy only manifest-owned affected functions", () => {
  const plan = buildImpactPlan(
    ["services/alpha/functions/alpha-v1/src/index.ts"],
    architecture,
    new Map(),
  )
  assert.equal(plan.final_gate.kind, "full")
  assert.deepEqual(plan.release.services, ["alpha"])
  assert.deepEqual(plan.release.functions, ["alpha-v1"])
  assert.equal(plan.release.database, "none")
})

test("Supabase function registry changes are manifest impact", () => {
  const plan = buildImpactPlan(["supabase/config.toml"], architecture, new Map())
  assert.deepEqual(plan.classifications.manifest, ["supabase/config.toml"])
  assert.deepEqual(plan.classifications.unknown, [])
  assert.equal(plan.final_gate.kind, "full")
})

test("migration plans select official DB flow then owner-only services", () => {
  const path = "supabase/migrations/20260723000000_alpha.sql"
  const plan = buildImpactPlan([path], architecture, new Map([[path, "alpha"]]))
  assert.equal(plan.release.database, "supabase_cli_preview_apply_parity")
  assert.deepEqual(plan.migrations, ["20260723000000"])
  assert.deepEqual(plan.release.functions, ["alpha-v1"])
})

test("unknown impact fails closed into the full gate", () => {
  const plan = buildImpactPlan(["unexpected.bin"], architecture, new Map())
  assert.equal(plan.final_gate.kind, "full")
  assert.deepEqual(plan.classifications.unknown, ["unexpected.bin"])
})

test("required job success wins over benign aggregate lag", () => {
  const run = {
    databaseId: 7,
    headSha: "a".repeat(40),
    status: "in_progress",
    conclusion: null,
  }
  const job = { id: 8, name: "deploy", status: "completed", conclusion: "success" }
  assert.equal(requiredJobState(run, job), "success")
  assert.equal(requiredJobState(run, undefined), "wait")
})

test("release consumes a validation receipt and never assumes a push event", async () => {
  const dev = await readFile("scripts/release/release_dev.ts", "utf8")
  const wait = await readFile("scripts/release/wait_for_workflow.ts", "utf8")
  assert.match(dev, /readValidationReceipt/)
  assert.doesNotMatch(dev + wait, /"push"|gh", \["run", "watch"/)
})

test("release receipts bind the exact plan and validation digest", () => {
  const impact = buildImpactPlan(["docs/deployment.md"], architecture, new Map())
  const plan = {
    schema_version: 1,
    base: { ref: "base", sha: "a".repeat(40), tree: "b".repeat(40) },
    head: { ref: "head", sha: "c".repeat(40), tree: "d".repeat(40) },
    changed_paths: ["docs/deployment.md"],
    diff_sha256: "e".repeat(64),
    impact_sha256: "f".repeat(64),
    impact,
  } as BoundPlan
  const validation = {
    schema_version: 1,
    kind: "validation",
    identities: {},
    counts: { commands: 1, passed: 1, failed: 0 },
    duration_ms: 1,
    run_log: {},
    commands: [],
    gate: "path_scoped",
    required_job: "validate-final",
  } as ValidationReceipt
  const receipt = buildReleaseReceipt(
    "dev", plan, validation, "1".repeat(64), false,
  )
  assert.equal(receipt.validation_receipt_sha256, "1".repeat(64))
  assert.match(receipt.plan_sha256, /^[0-9a-f]{64}$/)
  assert.deepEqual(receipt.functions, [])
})
