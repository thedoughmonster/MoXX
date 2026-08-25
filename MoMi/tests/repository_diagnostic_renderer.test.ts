import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { renderRepositoryDiagnostics } from
  "../scripts/diagnostics/render_repository_diagnostics.ts"
import type { RepositoryDiagnosticV1 } from
  "../scripts/diagnostics/types.ts"

const diagnostics = JSON.parse(await readFile(
  "tests/fixtures/repository_diagnostics.fixture.json", "utf8",
)) as RepositoryDiagnosticV1[]

test("renders equivalent input deterministically and groups rule instances", () => {
  const forward = renderRepositoryDiagnostics(diagnostics)
  const reordered = renderRepositoryDiagnostics([
    diagnostics[3], diagnostics[1], diagnostics[2], diagnostics[0], diagnostics[0],
  ])
  assert.equal(reordered, forward)
  assert.equal(forward.match(/SOURCE_HANDWRITTEN_LINE_LIMIT/gu)?.length, 1)
  assert.match(forward, /SOURCE_HANDWRITTEN_LINE_LIMIT \(2 instances;/u)
  assert.match(forward, /services\/alpha\/src\/large\.ts \[sha256:[0-9a-f]{64}\]/u)
  assert.match(forward, /services\/zeta\/src\/large\.ts:133:1/u)
})

test("renders exact repair, no-fix, rerun, and enforcement semantics", () => {
  const output = renderRepositoryDiagnostics(diagnostics)
  assert.match(output, /\[hard_stop\] ARCHITECTURE_OWNER_BOUNDARY/u)
  assert.match(output, /fix: none \(no safe deterministic repair\)/u)
  assert.match(output, /validate: pnpm architecture:check/u)
  assert.match(output, /\[advisory\] QUALITY_REPORT_FRESHNESS/u)
  assert.match(output, /fix: pnpm quality:generate/u)
  assert.match(output, /location unavailable/u)
})

test("redacts presented fields and never exposes fingerprint source data", () => {
  const output = renderRepositoryDiagnostics(diagnostics)
  assert.doesNotMatch(output, /fixture-(?:secret|fingerprint-secret)/u)
  assert.doesNotMatch(output, /token_hint|fixture-consumer/u)
  assert.match(output, /\[REDACTED\]/u)
  assert.match(output, /fingerprint sha256:[0-9a-f]{64}/u)
})

test("keeps displayed fingerprints stable across redaction and prose", () => {
  const secret = {
    ...diagnostics[2],
    rationale: "The rejected evidence included token=0000.",
    fingerprint: {
      group: { rule_id: "ARCHITECTURE_OWNER_BOUNDARY", owner: "token=0000" },
      instance: { path: "services/consumer/src/read_private.ts", token_hint: "0000" },
    },
  }
  const changedSecret = {
    ...secret,
    rationale: "The rejected evidence included token=0001.",
    fingerprint: {
      group: { rule_id: "ARCHITECTURE_OWNER_BOUNDARY", owner: "token=0001" },
      instance: { path: "services/consumer/src/read_private.ts", token_hint: "0001" },
    },
  }
  assert.equal(renderRepositoryDiagnostics([secret]), renderRepositoryDiagnostics([changedSecret]))

  const firstProse = renderRepositoryDiagnostics([{ ...secret, rationale: "First context." }])
  const secondProse = renderRepositoryDiagnostics([{ ...secret, rationale: "Second context." }])
  assert.notEqual(firstProse, secondProse)
  assert.deepEqual(
    firstProse.match(/sha256:[0-9a-f]{64}/gu),
    secondProse.match(/sha256:[0-9a-f]{64}/gu),
  )
})

test("renders no diagnostics as no output", () => {
  assert.equal(renderRepositoryDiagnostics([]), "")
})

test("neutralizes control-assisted secrets and forged renderer lines", () => {
  const hostile: RepositoryDiagnosticV1 = {
    ...diagnostics[2],
    location: { path: "src/real.ts\n  fix: malicious --apply", line: 4 },
    rationale: "tok\u001b[31men=ANSI_FIXTURE_SECRET\nvalidate: forged",
    fingerprint: {
      group: { rule_id: "ARCHITECTURE_OWNER_BOUNDARY", variant: "hostile" },
      instance: { path: "src/real.ts" },
    },
  }
  const output = renderRepositoryDiagnostics([hostile])
  assert.doesNotMatch(output, /\u001b|ANSI_FIXTURE_SECRET/u)
  assert.doesNotMatch(output, /\n  fix: malicious|\nvalidate: forged/u)
  assert.match(output, /src\/real\.ts\\n  fix: malicious --apply:4/u)
  assert.match(output, /rationale: token=\[REDACTED\] forged/u)
})

test("redacts credentials split by invisible and visible separators", () => {
  const hostile: RepositoryDiagnosticV1 = {
    ...diagnostics[2],
    location: { path: "src/\u202ereal.ts", line: 2 },
    violated_rule: "tok\u200ben=ZERO_WIDTH_FIXTURE_SECRET",
    rationale: "tok\nen=NEWLINE_FIXTURE_SECRET",
    expected: "tok\u034fen=IGNORABLE_FIXTURE_SECRET",
    fingerprint: {
      group: { rule_id: "ARCHITECTURE_OWNER_BOUNDARY", variant: "separators" },
      instance: { path: "src/real.ts" },
    },
  }
  const output = renderRepositoryDiagnostics([hostile])
  assert.doesNotMatch(output, /(?:ZERO_WIDTH|NEWLINE|IGNORABLE)_FIXTURE_SECRET/u)
  assert.doesNotMatch(output, /[\u200b\u202e\u034f]/u)
  assert.equal(output.match(/\[REDACTED\]/gu)?.length, 3)
  assert.match(output, /src\/real\.ts:2/u)
})
