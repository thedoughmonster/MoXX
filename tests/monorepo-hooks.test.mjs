import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { runMoMiCodexHook } from "../scripts/run-momi-codex-hook.mjs"

const root = resolve(new URL("..", import.meta.url).pathname)

function event(path) {
  return JSON.stringify({
    cwd: root,
    hook_event_name: "PreToolUse",
    tool_name: "Write",
    tool_input: { file_path: path },
  })
}

test("does not dispatch backend checks for a MoXi-only edit", async () => {
  assert.equal(
    await runMoMiCodexHook(event("MoXi/src/App.tsx"), "pre", root),
    undefined,
  )
})

test("routes MoMi migrations through the monorepo-aware guard", async () => {
  const migration = readdirSync(resolve(root, "MoMi/supabase/migrations"))
    .find((name) => name.endsWith(".sql"))
  assert.ok(migration)
  const source = await runMoMiCodexHook(
    event(`MoMi/supabase/migrations/${migration}`),
    "pre",
    root,
  )
  const output = JSON.parse(source)
  assert.equal(output.hookSpecificOutput.permissionDecision, "deny")
  const reason = JSON.parse(output.hookSpecificOutput.permissionDecisionReason)
  assert.equal(reason.diagnostics[0].path, `MoMi/supabase/migrations/${migration}`)
  assert.equal(
    reason.diagnostics[0].evidence.authority,
    "origin/prod:MoMi/supabase/migrations",
  )
})
