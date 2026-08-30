import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { executeChecks } from "../scripts/dev_loop/execute_checks.ts"
import { hashText } from "../scripts/dev_loop/hash_text.ts"

test("execution retains both raw streams with matching hashes", () => {
  const [evidence] = executeChecks([{
    id: "fixture-raw", command: process.execPath,
    args: ["-e", "process.stdout.write('alpha');process.stderr.write('beta');process.exit(1)"],
    enforcement: "hard_stop",
  }])
  assert.equal(readFileSync(evidence.stdout_path!, "utf8"), "alpha")
  assert.equal(readFileSync(evidence.stderr_path!, "utf8"), "beta")
  assert.equal(evidence.stdout_sha256, hashText("alpha"))
  assert.equal(evidence.stderr_sha256, hashText("beta"))
})

test("output beyond the child-process buffer stays complete", () => {
  const [evidence] = executeChecks([{
    id: "fixture-long", command: process.execPath,
    args: ["tests/fixtures/validation_output_child.ts", "long"],
    enforcement: "hard_stop",
  }])
  const stdout = readFileSync(evidence.stdout_path!, "utf8")
  assert.equal(evidence.status, 7)
  assert.ok(stdout.length > 2 * 1024 * 1024)
  assert.match(stdout, /complete\n$/u)
  assert.equal(evidence.stdout_sha256, hashText(stdout))
})

test("bound child checks receive only the resolved final candidate identities", () => {
  const base = "a".repeat(40)
  const head = "b".repeat(40)
  const [evidence] = executeChecks([{
    id: "fixture-bound-identities", command: process.execPath,
    args: ["-e", `process.exit(
      process.env.MOMI_VALIDATION_BASE_SHA === "${base}" &&
      process.env.MOMI_VALIDATION_HEAD_SHA === "${head}" &&
      process.env.MOMI_BASE_REF === "${base}" &&
      process.env.MOMI_HEAD_REF === "${head}" ? 0 : 9)`],
    enforcement: "hard_stop",
  }], { environment: {
    MOMI_VALIDATION_BASE_SHA: base,
    MOMI_VALIDATION_HEAD_SHA: head,
    MOMI_BASE_REF: base,
    MOMI_HEAD_REF: head,
  } })
  assert.equal(evidence.status, 0)
})
