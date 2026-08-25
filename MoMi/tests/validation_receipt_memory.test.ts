import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"

test("failed file evidence is summarized within a constrained heap", () => {
  const result = spawnSync(process.execPath, ["--max-old-space-size=64",
    "tests/fixtures/build_large_receipt_fixture.ts"], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /^2097152:8192:true\n/u)
  assert.match(result.stdout, /8192 or more total in raw logs/u)
})

test("maximum-length locations stay bounded and complete promptly", () => {
  const result = spawnSync(process.execPath, ["--max-old-space-size=64",
    "tests/fixtures/build_long_location_receipt_fixture.ts"], {
    encoding: "utf8", timeout: 10000,
  })
  assert.equal(result.status, 0, result.error?.message ?? result.stderr)
  const fields = result.stdout.trim().split(":")
  assert.deepEqual(fields.slice(0, 4), ["512", "512", "12", "false"])
  assert.ok(Number(fields[4]) < 8000)
  assert.ok(Number(fields[5]) < 8000)
  assert.ok(Number(fields[6]) <= 240)
  assert.deepEqual(fields.slice(7), ["true", "true"])
})
