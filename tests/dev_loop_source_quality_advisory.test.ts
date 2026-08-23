import assert from "node:assert/strict"
import test from "node:test"

import { buildCompactReceipt } from "../scripts/dev_loop/build_compact_receipt.ts"
import { executeChecks } from "../scripts/dev_loop/execute_checks.ts"
import { repositoryHardCheckIds } from
  "../scripts/dev_loop/repository_validation_contract.ts"
import { validateValidationReceipt } from
  "../scripts/dev_loop/validate_validation_receipt.ts"
import { validationExitCode } from "../scripts/dev_loop/validation_exit_code.ts"

const advisory = {
  rule: "source-quality-soft-limit" as const,
  path: "." as const,
  remediate: "Refactor reported handwritten files to 120 lines or fewer" as const,
}
const qualityAdvisory = { rule: "quality-report-freshness" as const,
  path: "docs/quality-metrics.json" as const,
  regenerate: "pnpm quality:generate" as const }

test("warning-only source quality evidence is advisory", () => {
  const receipt = buildCompactReceipt({ kind: "validation", commands: [{
    id: "source-quality", enforcement: "hard_stop", status: 0, duration_ms: 1,
  }, {
    id: "source-quality-soft-limit", enforcement: "advisory", advisory,
    status: 1, duration_ms: 1,
    stderr: "notes/soft.md: 121 lines (soft limit 120)",
  }] })
  assert.equal(validationExitCode(receipt), 0)
  assert.equal(receipt.counts.advisory_findings, 1)
  assert.match(receipt.commands[1].advisory_excerpt ?? "", /121 lines/)
})

test("hard source quality evidence remains blocking", () => {
  const receipt = buildCompactReceipt({ kind: "validation", commands: [{
    id: "source-quality", enforcement: "hard_stop", status: 1, duration_ms: 1,
    stderr: "notes/hard.md: 141 lines (hard limit 140)",
  }, {
    id: "source-quality-soft-limit", enforcement: "advisory", advisory,
    status: 0, duration_ms: 1,
  }] })
  assert.equal(validationExitCode(receipt), 1)
  assert.equal(receipt.counts.hard_failed, 1)
})

test("mixed source quality evidence retains both dispositions", () => {
  const receipt = buildCompactReceipt({ kind: "validation", commands: [{
    id: "source-quality", enforcement: "hard_stop", status: 1, duration_ms: 1,
    stderr: "notes/hard.md: 141 lines (hard limit 140)",
  }, {
    id: "source-quality-soft-limit", enforcement: "advisory", advisory,
    status: 1, duration_ms: 1,
    stderr: "notes/soft.md: 140 lines (soft limit 120)",
  }] })
  assert.equal(validationExitCode(receipt), 1)
  assert.equal(receipt.counts.hard_failed, 1)
  assert.equal(receipt.counts.advisory_findings, 1)
  assert.match(receipt.commands[0].failure_excerpt ?? "", /hard limit 140/)
  assert.match(receipt.commands[1].advisory_excerpt ?? "", /soft limit 120/)
})

test("advisory identities reject swapped or extended metadata", () => {
  assert.throws(() => buildCompactReceipt({ kind: "validation", commands: [{
    id: "source-quality-soft-limit", enforcement: "advisory",
    advisory: qualityAdvisory, status: 1, duration_ms: 1,
  }] }), /Invalid command evidence/)
  assert.throws(() => executeChecks([{
    id: "quality-report", command: process.execPath, args: ["-e", ""],
    enforcement: "advisory", advisory,
  }]), /Invalid enforcement metadata/)
  assert.throws(() => buildCompactReceipt({ kind: "validation", commands: [{
    id: "source-quality-soft-limit", enforcement: "advisory",
    advisory: { ...advisory, extra: true }, status: 1, duration_ms: 1,
  }] } as never), /Invalid command evidence/)
})

test("authoritative receipts bind advisory metadata to command identity", () => {
  const compact = buildCompactReceipt({ kind: "validation", run_id: "7",
    base_sha: "a".repeat(40), head_sha: "b".repeat(40),
    base_tree: "c".repeat(40), head_tree: "d".repeat(40),
    diff_sha256: "e".repeat(64), impact_sha256: "f".repeat(64),
    plan_sha256: "1".repeat(64), commands: [
      ...repositoryHardCheckIds.map((id) => ({ id, enforcement: "hard_stop" as const,
        status: 0, duration_ms: 1 })),
      { id: "source-quality-soft-limit", enforcement: "advisory" as const,
        advisory, status: 1, duration_ms: 1, stderr: "soft finding" },
      { id: "quality-report", enforcement: "advisory" as const,
        advisory: qualityAdvisory, status: 0, duration_ms: 1 },
    ] })
  const receipt = { ...compact, kind: "validation" as const, gate: "full" as const,
    required_job: "validate-final" }
  assert.equal(validateValidationReceipt(receipt), receipt)
  const swapped = { ...receipt, commands: receipt.commands.map((item) =>
    item.id === "source-quality-soft-limit" ? { ...item, advisory: qualityAdvisory }
      : item.id === "quality-report" ? { ...item, advisory } : item) }
  assert.throws(() => validateValidationReceipt(swapped),
    /Invalid authoritative validation receipt/)
})
