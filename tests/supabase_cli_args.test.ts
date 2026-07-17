import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { buildSupabaseArgs } from "../scripts/deploy/build_supabase_args.ts"

test("leaves Supabase CLI arguments unchanged without explicit debug opt-in", () => {
  const args = ["db", "push", "--linked", "--dry-run", "--yes"]
  assert.deepEqual(buildSupabaseArgs(args, {}), args)
  assert.notEqual(buildSupabaseArgs(args, {}), args)
  assert.deepEqual(buildSupabaseArgs(args, { MOMI_SUPABASE_CLI_DEBUG: "true" }), args)
})

test("appends one Supabase CLI debug flag only for MOMI_SUPABASE_CLI_DEBUG=1", () => {
  const args = ["db", "push", "--linked"]
  assert.deepEqual(
    buildSupabaseArgs(args, { MOMI_SUPABASE_CLI_DEBUG: "1" }),
    ["db", "push", "--linked", "--debug"],
  )
  assert.deepEqual(
    buildSupabaseArgs([...args, "--debug"], { MOMI_SUPABASE_CLI_DEBUG: "1" }),
    ["db", "push", "--linked", "--debug"],
  )
})

test("runs Supabase CLI through an argument array without shell expansion", async () => {
  const source = await readFile(
    new URL("../scripts/deploy/run_supabase.ts", import.meta.url),
    "utf8",
  )
  assert.match(source, /spawnSync\(process\.execPath, \[launcher, \.\.\.buildSupabaseArgs\(args\)\]/)
  assert.doesNotMatch(source, /shell:\s*true/)
})
