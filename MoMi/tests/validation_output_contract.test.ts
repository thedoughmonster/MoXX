import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"

import { buildCompactReceipt } from "../scripts/dev_loop/build_compact_receipt.ts"
import { renderAgentValidationSummary } from
  "../scripts/dev_loop/render_agent_validation_summary.ts"
import type { CompactReceipt } from "../scripts/dev_loop/types.ts"

test("successful validation output is bounded and points to evidence", () => {
  const receipt = buildCompactReceipt({ kind: "validation", commands: [{
    id: "tests", enforcement: "hard_stop", status: 0, duration_ms: 12,
    stdout_path: ".momi/logs/tests.stdout.log",
    stderr_path: ".momi/logs/tests.stderr.log",
    stdout: "third-party progress chatter that must stay raw",
  }] })
  const summary = renderAgentValidationSummary(receipt, ".momi/test-receipt.json")
  assert.match(summary, /^Validation PASS: 1 checks in 12ms/mu)
  assert.match(summary, /pass \[hard_stop\] tests \(12ms, exit 0\)/u)
  assert.match(summary, /Receipt: \.momi\/test-receipt\.json/u)
  assert.match(summary, /Raw logs: \.momi\/logs\//u)
  assert.doesNotMatch(summary, /third-party progress/u)
  assert.match(receipt.commands[0].stdout_sha256, /^[0-9a-f]{64}$/u)
})

test("multiple failures group equivalents and retain locations", () => {
  const repeated = [
    "Progress: resolved 99, added 99",
    "✔ earlier passing test (5ms)",
    '{"unrelated":"successful child output"}',
    "✖ failing tests:",
    "src/first.ts:10:2 rule/example: invalid value token=fixture-secret",
    "    at longStack (node:internal/test:1:1)",
    "src/second.ts:20:4 rule/example: invalid value token=fixture-secret",
    ...Array.from({ length: 40 }, (_, index) => `    at frame${index} (stack.ts:${index}:1)`),
  ].join("\n")
  const receipt = buildCompactReceipt({ kind: "validation", commands: [{
    id: "lint", enforcement: "hard_stop", status: 2, duration_ms: 8,
    stdout_path: ".momi/logs/lint.stdout.log",
    stderr_path: ".momi/logs/lint.stderr.log", stderr: repeated,
  }, {
    id: "architecture", enforcement: "hard_stop", status: 1, duration_ms: 3,
    stdout_path: ".momi/logs/missing-contract.stdout.log",
    stderr_path: ".momi/logs/missing-contract.stderr.log",
  }] })
  const summary = renderAgentValidationSummary(receipt, ".momi/receipt.json")
  assert.equal(summary.match(/^Failure:/gmu)?.length, 2)
  assert.match(summary, /2 equivalent occurrences/u)
  assert.match(summary, /src\/first\.ts:10:2, src\/second\.ts:20:4/u)
  assert.match(summary, /\(no diagnostic output\)/u)
  assert.match(summary, /inspect: cat -- \.momi\/logs\/lint\.stdout\.log/u)
  assert.doesNotMatch(summary,
    /fixture-secret|Progress:|earlier passing|successful child|longStack|frame39/u)
  assert.doesNotMatch(JSON.stringify(receipt), /fixture-secret/u)
})

test("advisory metadata remains actionable without changing exit disposition", () => {
  const receipt = buildCompactReceipt({ kind: "validation", commands: [{
    id: "quality-report", enforcement: "advisory", status: 1, duration_ms: 4,
    advisory: { rule: "quality-report-freshness",
      path: "docs/quality-metrics.json", regenerate: "pnpm quality:generate" },
    stderr: "Status: stale",
  }] })
  const summary = renderAgentValidationSummary(receipt, ".momi/receipt.json")
  assert.match(summary, /^Validation PASS:/u)
  assert.match(summary, /Advisory: quality-report[\s\S]+remediate: pnpm quality:generate/u)
})

test("source-quality advisory metadata renders its bounded remediation", () => {
  const receipt = buildCompactReceipt({ kind: "validation", commands: [{
    id: "source-quality-soft-limit", enforcement: "advisory", status: 1,
    duration_ms: 4, advisory: { rule: "source-quality-soft-limit", path: ".",
      remediate: "Refactor reported handwritten files to 120 lines or fewer" },
    stderr: "notes/soft.md: 121 lines (soft limit 120)",
  }] })
  const summary = renderAgentValidationSummary(receipt, ".momi/receipt.json")
  assert.match(summary, /Advisory: source-quality-soft-limit/u)
  assert.match(summary, /remediate: Refactor reported handwritten files/u)
})

test("canonical entry points use the shared compact runner", () => {
  for (const path of ["scripts/check.ts", "scripts/run_check.ts",
    "scripts/run_check_changed.ts", "scripts/run_tests.ts"]) {
    assert.match(readFileSync(path, "utf8"), /runValidation/u, path)
  }
})

test("runner fixtures prove bounded success and single-failure output", () => {
  const fixture = "tests/fixtures/run_validation_fixture.ts"
  const success = spawnSync(process.execPath, [fixture, "success"], { encoding: "utf8" })
  assert.equal(success.status, 0)
  assert.match(success.stdout, /^Validation PASS: 1 checks/mu)
  assert.doesNotMatch(success.stdout, /passing raw detail|Progress:/u)
  const failure = spawnSync(process.execPath, [fixture, "single"], { encoding: "utf8" })
  assert.equal(failure.status, 2)
  assert.equal(failure.stdout.match(/^Failure:/gmu)?.length, 1)
  assert.match(failure.stdout, /2 equivalent occurrences/u)
})

test("runner fixture reports every failure and advisory without raw chatter", () => {
  const result = spawnSync(process.execPath,
    ["tests/fixtures/run_validation_fixture.ts", "multiple"], { encoding: "utf8" })
  assert.equal(result.status, 2)
  assert.equal(result.stdout.match(/^Failure:/gmu)?.length, 2)
  assert.equal(result.stdout.match(/^Advisory:/gmu)?.length, 1)
  assert.match(result.stdout, /src\/first\.ts:10:2, src\/second\.ts:20:4/u)
  assert.match(result.stdout, /fixture-missing[\s\S]+\(no diagnostic output\)/u)
  assert.match(result.stdout, /remediate: pnpm quality:generate/u)
  assert.doesNotMatch(result.stdout,
    /fixture-secret|Progress:|earlier passing|deepStack|frame39/u)
  const receipt = JSON.parse(readFileSync(
    ".momi/fixture-validation-receipt.json", "utf8")) as CompactReceipt
  const stderrPath = receipt.commands[0]?.stderr_path
  assert.ok(stderrPath)
  assert.match(readFileSync(stderrPath, "utf8"), /fixture-secret[\s\S]+frame39/u)
})
