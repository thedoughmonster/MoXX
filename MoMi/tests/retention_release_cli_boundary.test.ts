import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import test from "node:test"
import { runRetentionSupabase } from "../scripts/release/retention/run_supabase.ts"

test("secret and API-key inventory never reaches the retention CLI delegate", () => {
  const calls: string[][] = []
  const delegate = (args: string[]) => { calls.push(args); return "FORBIDDEN_METADATA_SENTINEL" }
  for (const args of [["secrets", "list", "--output", "json"], ["secrets", "get"],
    ["projects", "api-keys"], ["api-keys", "list"], ["functions", "secrets"],
    ["functions", "deploy"], ["db", "dump"], ["link"], [], ["FORBIDDEN_VALUE_SENTINEL"]]) {
    assert.throws(() => runRetentionSupabase(args, true, delegate), (error: unknown) => {
      assert.match(String(error), /Unsupported retention CLI operation/)
      assert.doesNotMatch(String(error), /FORBIDDEN_/)
      return true
    })
  }
  assert.deepEqual(calls, [])
  for (const args of [["db", "query", "--linked", "select 1"],
    ["functions", "list", "--project-ref", "synthetic-project", "--output", "json"]]) {
    assert.equal(runRetentionSupabase(args, true, (received, capture) => {
      assert.equal(capture, true)
      calls.push(received)
      return "non-secret-result"
    }), "non-secret-result")
  }
  assert.equal(calls.length, 2)
})

test("retention inspection cannot bypass its restricted transport or serialize secret inventory", async () => {
  const directory = new URL("../scripts/release/retention/", import.meta.url)
  for (const name of (await readdir(directory)).filter((item) => item.endsWith(".ts"))) {
    const source = await readFile(new URL(name, directory), "utf8")
    assert.doesNotMatch(source, /["']secrets["']|api-keys|assertRetentionConfiguration/)
    if (name !== "run_supabase.ts") assert.doesNotMatch(source, /deploy\/run_supabase\.ts|node:child_process/)
  }
  const execute = await readFile(new URL("execute.ts", directory), "utf8")
  assert.match(execute, /runRetentionSupabase as runSupabase/)
  assert.equal((execute.match(/approveRetention\(approval/g) ?? []).length, 2)
  assert.ok(execute.indexOf("approveRetention(approval") < execute.indexOf('evidence.stage = "sql"'))
  assert.ok(execute.lastIndexOf("approveRetention(approval") < execute.indexOf("deployFunctions(approval"))
  assert.doesNotMatch(execute, /metrics_secret_attestation|configuration_inventory|secret_digest/)
  assert.match(execute, /health.disposition !== "configured"/)
  assert.match(execute, /policy.phase !== "disarmed"/)
})
