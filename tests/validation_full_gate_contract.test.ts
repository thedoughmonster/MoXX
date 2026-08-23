import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import type { Architecture } from "../scripts/architecture/types.ts"
import { discoverTestFiles } from "../scripts/discover_test_files.ts"
import { buildImpactPlan } from "../scripts/dev_loop/build_impact_plan.ts"
import { repositoryHardCheckIds } from
  "../scripts/dev_loop/repository_validation_contract.ts"

const architecture = { services: [], functions: [] } as unknown as Architecture

test("authoritative full plans expose every repository check identity", () => {
  const plan = buildImpactPlan(["workspace.json"], architecture, new Map())
  assert.equal(plan.final_gate.kind, "full")
  assert.deepEqual(plan.final_gate.checks.map((item) => item.id), [
    ...repositoryHardCheckIds, "quality-report",
  ])
  assert.equal(plan.final_gate.checks.some((item) => item.id === "full-repository"), false)
  const tests = plan.final_gate.checks.find((item) => item.id === "tests")
  assert.deepEqual(tests?.args,
    ["scripts/run_discovered_tests.ts", "--service", "all"])
})

test("full-gate discovery includes tests outside current capability roots", async () => {
  mkdirSync(".momi", { recursive: true })
  const fixture = resolve(".momi/recursive-discovery-fixture.test.ts")
  writeFileSync(fixture, "export {}\n")
  try {
    assert.ok((await discoverTestFiles("all")).includes(fixture))
  } finally {
    rmSync(fixture)
  }
})

test("full-gate failures report an early check and the late tests check", () => {
  const result = spawnSync(process.execPath,
    ["tests/fixtures/run_full_validation_fixture.ts"], { encoding: "utf8" })
  assert.equal(result.status, 2)
  assert.equal(result.stdout.match(/^Failure:/gmu)?.length, 2)
  assert.match(result.stdout, /Failure: architecture[\s\S]+src\/first\.ts:10:2/u)
  assert.match(result.stdout, /Failure: tests[\s\S]+src\/second\.ts:20:4/u)
  assert.match(result.stdout,
    /inspect: cat -- \.momi\/logs\/run-[^/]+\/tests\.stdout\.log \.momi\/logs\/run-[^/]+\/tests\.stderr\.log/u)
  assert.doesNotMatch(result.stdout, /passing raw detail|Progress:|fixture-secret/u)
})
