import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { runSupabase } from "../scripts/deploy/run_supabase.ts"

test("strips ambient database credentials from the child environment", () => {
  const launcher = fileURLToPath(
    new URL("./fixtures/supabase_child_probe.ts", import.meta.url),
  )
  const output = runSupabase(["probe-argument"], true, launcher)
  const child = JSON.parse(output) as Record<string, unknown>
  assert.deepEqual(child.args, ["probe-argument"])
  assert.equal(child.profile, "supabase")
  assert.equal(child.telemetry, "1")
  assert.equal(child.hasReleasePassword, false)
  assert.equal(child.hasPostgresPassword, false)
})
