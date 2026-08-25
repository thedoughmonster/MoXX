import assert from "node:assert/strict"
import { test } from "node:test"
import { parse } from "pgsql-ast-parser"

import { generateDeadmanTerminalCommand } from "./generate_deadman_terminal_command.ts"

const input = {
  runId: "run-20260802-abcdef",
  generationSha256: "a".repeat(64),
  expiryUtc: "2026-08-02T02:03:04.123456Z",
  guardRunId: 1_005,
  guardStartUtc: "2026-08-02T02:03:05.123456Z",
  exactIdentityMask: 15,
  activeBeforeMask: 0,
  inactiveAfterMask: 15,
  originalCommandSha256: "b".repeat(64),
  originalCommandMd5: "c".repeat(32),
}

test("terminal command is canonical bounded evidence and read-only", () => {
  const command = generateDeadmanTerminalCommand(input)
  assert.equal(command, generateDeadmanTerminalCommand(structuredClone(input)))
  assert.deepEqual(parse(command).map((statement) => statement.type), ["select"])
  assert.match(command, /momi:deadman:terminal:v1/)
  assert.match(command, /1005::bigint as guard_run_id/)
  assert.match(command, /15::integer as exact_identity_mask/)
  assert.doesNotMatch(command, /cron\.|insert|update|delete|payload|token|password/i)
})

test("terminal command rejects drift, injection, and unsupported masks", () => {
  for (const change of [
    { runId: "run-x'; select 1; --" },
    { guardRunId: -1 }, { exactIdentityMask: 16 },
    { activeBeforeMask: -1 }, { inactiveAfterMask: 16 },
    { guardStartUtc: "2026-08-02T02:03:05Z" },
    { originalCommandSha256: "A".repeat(64) },
    { extra: true },
  ]) assert.throws(() => generateDeadmanTerminalCommand({ ...input, ...change }))
})
