import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import { parse } from "pgsql-ast-parser"
import {
  DEADMAN_EXPIRY_PLACEHOLDER,
  DEADMAN_EXPIRY_SQL_EXPRESSION,
} from "./deadman_command_constants.ts"
import { VALID_DEADMAN_INPUT } from "./deadman_command.test_fixture.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"

test("dead-man command generation is byte deterministic", () => {
  const command = generateDeadmanCommand(VALID_DEADMAN_INPUT)
  assert.equal(command, generateDeadmanCommand(structuredClone(VALID_DEADMAN_INPUT)))
  assert.equal(Buffer.byteLength(command), 4_310)
  assert.equal(createHash("sha256").update(command).digest("hex"),
    "d89355308c319b1c51e9c235e407d799af86b22df3e5383fda840869eaa2ff9b")
  assert.deepEqual(parse(command).map((statement) => statement.type), ["do"])
})

test("dead-man input rejects injection, controls, timestamps, and extra fields", () => {
  const invalid = [
    { ...VALID_DEADMAN_INPUT, runId: "run-20260802-- comment" },
    { ...VALID_DEADMAN_INPUT, runId: "run-20260802\nabcdef" },
    { ...VALID_DEADMAN_INPUT, generationSha256: `${"a".repeat(63)};` },
    { ...VALID_DEADMAN_INPUT, generationSha256: "A".repeat(64) },
    { ...VALID_DEADMAN_INPUT, guardName: "other-guard" },
    { ...VALID_DEADMAN_INPUT, guardSchedule: "10 seconds" },
    { ...VALID_DEADMAN_INPUT, advisoryLockKey: "other-lock" },
    { ...VALID_DEADMAN_INPUT, expiryPlaceholder: "2026-08-02T02:00:00Z" },
    { ...VALID_DEADMAN_INPUT, expiryPlaceholder: "clock_timestamp()" },
    { ...VALID_DEADMAN_INPUT, extra: "field" },
    { ...VALID_DEADMAN_INPUT, targetJobs: VALID_DEADMAN_INPUT.targetJobs.map(
      (job, index) => index === 0 ? { ...job, jobName: "x'; select 1; --" } : job,
    ) },
  ]
  for (const value of invalid) assert.throws(() => generateDeadmanCommand(value))
})

test("generated command has only the bounded dead-man operation surface", () => {
  const command = generateDeadmanCommand(VALID_DEADMAN_INPUT)
  assert.match(command, /pg_advisory_xact_lock/)
  assert.match(command, new RegExp(DEADMAN_EXPIRY_PLACEHOLDER))
  assert.equal(DEADMAN_EXPIRY_SQL_EXPRESSION,
    "clock_timestamp() + interval '30 seconds'")
  assert.equal((command.match(/cron\.alter_job/g) ?? []).length, 5)
  assert.doesNotMatch(command, /--|\/\*|\*\//)
  assert.doesNotMatch(command,
    /cron\.(schedule|unschedule)|\b(update|insert|delete|drop|truncate|create)\b/i)
  assert.doesNotMatch(command,
    /https?:|access[_-]?token|password|payload|customer|payment|pg_net|net\./i)
  assert.doesNotMatch(command, /raise (warning|exception)/)
  assert.match(command, /exact_identity_mask/)
  assert.match(command, /active_before_mask/)
  assert.match(command, /inactive_after_mask/)
  assert.match(command,
    /guard_start_at := coalesce\(guard_start_at, expiry_at - interval '30 seconds'\)/)
})

test("expiry path is scoped, ordered, and self-deactivates last", () => {
  const command = generateDeadmanCommand(VALID_DEADMAN_INPUT)
  const targetCalls = [3, 2, 11].map((jobId) =>
    command.indexOf(`cron.alter_job(job_id := ${jobId}, active := false)`)
  )
  assert.ok(targetCalls.every((position) => position > 0))
  assert.deepEqual([...targetCalls].sort((a, b) => a - b), targetCalls)
  assert.doesNotMatch(command, /cron\.alter_job\(job_id := 4/)
  const terminalRewrite = command.indexOf(
    "cron.alter_job(job_id := guard_job_id, command := terminal_command)",
  )
  const guardCall = command.indexOf(
    "cron.alter_job(job_id := guard_job_id, active := false)",
  )
  assert.ok(guardCall > targetCalls.at(-1)!)
  assert.ok(terminalRewrite > targetCalls.at(-1)!)
  assert.ok(guardCall > terminalRewrite)
  assert.match(command.slice(guardCall),
    /^cron\.alter_job\(job_id := guard_job_id, active := false\);\nend\n\$\$;\n$/)
})
