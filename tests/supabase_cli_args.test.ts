import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { buildSupabaseArgs } from "../scripts/deploy/build_supabase_args.ts"

test("leaves approved Supabase CLI arguments unchanged", () => {
  const args = ["db", "push", "--linked", "--dry-run", "--yes"]
  assert.deepEqual(buildSupabaseArgs(args), args)
  assert.notEqual(buildSupabaseArgs(args), args)
})

test("rejects every Supabase CLI debug flag form", () => {
  for (const debugArgument of ["--debug", "--debug=true"]) {
    assert.throws(
      () => buildSupabaseArgs(["db", "push", "--linked", debugArgument]),
      /--debug is forbidden/,
    )
  }
})

test("keeps Supabase CLI invocation environment-neutral and shell-free", async () => {
  const builder = await readFile(
    new URL("../scripts/deploy/build_supabase_args.ts", import.meta.url),
    "utf8",
  )
  const runner = await readFile(
    new URL("../scripts/deploy/run_supabase.ts", import.meta.url),
    "utf8",
  )
  assert.doesNotMatch(builder, /MOMI_SUPABASE_CLI_DEBUG|process\.env/)
  assert.match(runner, /spawnSync\(process\.execPath, \[launcher, \.\.\.buildSupabaseArgs\(args\)\]/)
  assert.doesNotMatch(runner, /shell:\s*true/)
})
