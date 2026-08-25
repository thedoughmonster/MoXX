import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { executeChecks } from "../scripts/dev_loop/execute_checks.ts"
import { hashText } from "../scripts/dev_loop/hash_text.ts"

test("canonical tests retain complete evidence across nested validation", () => {
  const [first] = executeChecks([{
    id: "tests", command: process.execPath,
    args: ["tests/fixtures/run_nested_validation_fixture.ts"],
    enforcement: "hard_stop",
  }])
  const firstStdout = readFileSync(first.stdout_path!, "utf8")
  const firstStderr = readFileSync(first.stderr_path!, "utf8")
  const [second] = executeChecks([{
    id: "tests", command: process.execPath,
    args: ["-e", "process.stdout.write('second invocation')"],
    enforcement: "hard_stop",
  }])
  assert.notEqual(first.stdout_path, second.stdout_path)
  assert.match(firstStdout, /^outer-stdout-before\nValidation PASS:[\s\S]+outer-stdout-after\n$/u)
  assert.equal(firstStderr, "outer-stderr-before\nouter-stderr-after\n")
  assert.equal(readFileSync(first.stdout_path!, "utf8"), firstStdout)
  assert.equal(first.stdout_sha256, hashText(firstStdout))
  assert.equal(first.stderr_sha256, hashText(firstStderr))
})
