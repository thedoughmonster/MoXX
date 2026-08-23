import assert from "node:assert/strict"
import test from "node:test"

import { buildCompactReceipt } from "../scripts/dev_loop/build_compact_receipt.ts"
import { executeChecks } from "../scripts/dev_loop/execute_checks.ts"
import { renderValidationSummary } from
  "../scripts/dev_loop/render_validation_summary.ts"
import { repositoryHardCheckIds } from "../scripts/dev_loop/repository_validation_contract.ts"
import { validateValidationReceipt } from
  "../scripts/dev_loop/validate_validation_receipt.ts"
import { validationExitCode } from "../scripts/dev_loop/validation_exit_code.ts"
import { isQualityReportCurrent } from
  "../scripts/quality/is_quality_report_current.ts"
import { parseQualityReport } from "../scripts/quality/parse_quality_report.ts"

test("quality metric drift is advisory with deterministic guidance", () => {
  assert.equal(isQualityReportCurrent("135191\n", "135205\n"), false)
  const receipt = buildCompactReceipt({
    kind: "validation",
    base_sha: "a".repeat(40), head_sha: "b".repeat(40),
    base_tree: "c".repeat(40), head_tree: "d".repeat(40),
    diff_sha256: "e".repeat(64), impact_sha256: "f".repeat(64),
    plan_sha256: "1".repeat(64),
    commands: [{
      id: "quality-report",
      command: "node",
      args: ["scripts/check_quality_report.ts"],
      enforcement: "advisory",
      advisory: { rule: "quality-report-freshness",
        path: "docs/quality-metrics.json", regenerate: "pnpm quality:generate" },
      status: 1,
      duration_ms: 4,
      stderr: "token=advisory-secret\nStatus: stale\nRegenerate: pnpm quality:generate",
    }],
  })
  assert.equal(receipt.counts.hard_failed, 0)
  assert.equal(receipt.counts.advisory_findings, 1)
  assert.equal(validationExitCode(receipt), 0)
  assert.doesNotMatch(receipt.commands[0].advisory_excerpt ?? "", /advisory-secret/)
  const summary = renderValidationSummary(receipt)
  assert.match(summary, /Head commit: `b{40}`/)
  assert.match(summary, /Base tree: `c{40}`[\s\S]+Plan SHA-256: `1{64}`/)
  assert.match(summary, /quality-report-freshness/)
  assert.match(summary, /pnpm quality:generate/)
})
test("hard source quality failures still stop validation", () => {
  const receipt = buildCompactReceipt({
    kind: "validation",
    commands: [{
      id: "source-quality", command: "node",
      args: ["scripts/check_source_quality.ts"], enforcement: "hard_stop",
      status: 1, duration_ms: 2,
      stderr: "source exceeds the hard line threshold",
    }],
  })
  assert.equal(receipt.counts.hard_failed, 1)
  assert.equal(validationExitCode(receipt), 1)
})
test("unknown enforcement metadata fails closed", () => {
  assert.throws(() => executeChecks([{ id: "unknown", command: process.execPath,
    args: ["-e", "process.exit(99)"], enforcement: "unknown" }] as never),
  /Invalid enforcement metadata/)
  assert.throws(() => buildCompactReceipt({
    kind: "validation",
    commands: [{
      id: "unknown", command: "node", args: [], enforcement: "unknown",
      status: 0, duration_ms: 1,
    }],
  } as never), /Invalid command evidence/)
})
test("quality report validity rejects malformed required evidence", () => {
  assert.throws(() => parseQualityReport("{"), /valid JSON/)
  assert.throws(() => parseQualityReport(JSON.stringify({
    generated: true,
    purpose: "Repository-wide trend signals; compare this file through Git history.",
    metrics: { handwritten_lines: 1 },
  })), /metric fields/)
})

test("validation receipt counts are recomputed", () => {
  const compact = buildCompactReceipt({
    kind: "validation",
    base_sha: "a".repeat(40), head_sha: "b".repeat(40),
    base_tree: "c".repeat(40), head_tree: "d".repeat(40),
    diff_sha256: "e".repeat(64), impact_sha256: "f".repeat(64),
    plan_sha256: "1".repeat(64), run_id: "7",
    commands: [...repositoryHardCheckIds.map((id) => ({
      id, command: "node", args: [], enforcement: "hard_stop" as const,
      status: 0, duration_ms: 1,
    })), {
      id: "quality-report", command: "node", args: [], enforcement: "advisory",
      advisory: { rule: "quality-report-freshness",
        path: "docs/quality-metrics.json", regenerate: "pnpm quality:generate" },
      status: 0, duration_ms: 1,
    }],
  })
  const receipt = {
    ...compact, kind: "validation" as const, gate: "full" as const,
    required_job: "validate-final",
  }
  assert.equal(validateValidationReceipt(receipt), receipt)
  assert.throws(() => validateValidationReceipt({
    ...receipt,
    counts: { ...receipt.counts, hard_passed: 0 },
  }), /Invalid authoritative validation receipt/)
  assert.throws(() => validateValidationReceipt({
    ...receipt,
    commands: [{ ...receipt.commands[0], enforcement: "unknown" }],
  }), /Invalid authoritative validation receipt/)
  for (const [gate, id] of [
    ["full", "full-repository:hard_stop,quality-report"],
    ["path_scoped", "focused-tests:hard_stop,source-quality:hard_stop," +
      "quality-report-validity:hard_stop,quality-report"],
  ] as const) assert.throws(() => validateValidationReceipt({
    ...receipt, gate, commands: [{ ...receipt.commands[1], id }],
    counts: { commands: 1, hard_passed: 0, hard_failed: 0,
      advisory_passed: 1, advisory_findings: 0 }, duration_ms: 1,
  }), /Invalid authoritative validation receipt/)
  assert.throws(() => validateValidationReceipt({ ...receipt, commands: {} }), /Invalid authoritative validation receipt/)
})
