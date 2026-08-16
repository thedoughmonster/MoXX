import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { renderHookOutput } from "../scripts/codex_hooks/render_hook_output.ts"
import { runPostWriteDiagnostics } from
  "../scripts/codex_hooks/run_post_write_diagnostics.ts"

const policies = { max_handwritten_lines: 120, hard_max_handwritten_lines: 140 }

test("injects compact same-session context without full validation calls", async () => {
  const output = renderHookOutput([{
    code: "SOURCE_HANDWRITTEN_LINE_LIMIT",
    path: "notes/soft.md",
    severity: "advisory",
    evidence: { actual: 121, limit: 120 },
    repair_class: "BOUNDED_REFACTOR",
  }]) as { hookSpecificOutput: { additionalContext: string } }
  const context = JSON.parse(output.hookSpecificOutput.additionalContext)
  assert.equal(context.diagnostics[0].path, "notes/soft.md")
  const sources = await Promise.all([
    readFile(join(workspaceRoot, ".codex", "hooks.json"), "utf8"),
    readFile(join(workspaceRoot, "scripts", "run_post_write_diagnostics.ts"), "utf8"),
    readFile(join(
      workspaceRoot,
      "scripts",
      "codex_hooks",
      "run_post_write_diagnostics.ts",
    ), "utf8"),
  ])
  assert.match(sources[0], /\^\(apply_patch\|Edit\|Write\)\$/)
  assert.doesNotMatch(sources.join("\n"), /momi-check|validate-final|scripts\/check/)
})

test("fails safely when the event contract is incomplete", async () => {
  const diagnostics = await runPostWriteDiagnostics({
    hook_event_name: "PostToolUse",
    tool_name: "apply_patch",
    tool_input: {},
  }, { policies, root: workspaceRoot })
  assert.equal(diagnostics[0].code, "POST_WRITE_HOOK_INPUT_INVALID")
  assert.equal(diagnostics[0].severity, "error")
})
