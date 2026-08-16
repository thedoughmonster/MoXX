import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { performance } from "node:perf_hooks"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import test from "node:test"

const directory = fileURLToPath(new URL("./", import.meta.url))
const hook = fileURLToPath(
  new URL("./fixture/.codex/hooks/fixture_hook.mjs", import.meta.url),
)
const config = fileURLToPath(
  new URL("./fixture/.codex/hooks.json", import.meta.url),
)
const shared = {
  session_id: "fixture-session",
  turn_id: "fixture-turn",
  transcript_path: null,
  cwd: directory,
  permission_mode: "default",
  model: "fixture-model",
  tool_name: "apply_patch",
  tool_use_id: "fixture-tool-use",
}

test("PostToolUse returns one model-visible structured diagnostic", () => {
  const input = {
    ...shared,
    hook_event_name: "PostToolUse",
    tool_input: { command: "*** Update File: fixture/diagnostic.txt" },
    tool_response: { output: "Done!" },
  }
  const result = spawnSync(process.execPath, [hook], {
    encoding: "utf8",
    input: JSON.stringify(input),
  })
  assert.equal(result.status, 0)
  const output = JSON.parse(result.stdout)
  const context = JSON.parse(output.hookSpecificOutput.additionalContext)
  assert.deepEqual(context.diagnostics[0], {
    code: "CODEX_HOOK_CONTRACT_FIXTURE",
    path: "fixture/diagnostic.txt",
    severity: "error",
    evidence: {
      event: "PostToolUse",
      tool_name: "apply_patch",
      hook_runtime_ms: context.diagnostics[0].evidence.hook_runtime_ms,
    },
    repair_class: "SEMANTIC_REPAIR",
  })
})

test("PreToolUse denies the protected path before tool execution", () => {
  const input = {
    ...shared,
    hook_event_name: "PreToolUse",
    tool_input: { command: "*** Update File: fixture/protected.txt" },
  }
  const result = spawnSync(process.execPath, [hook], {
    encoding: "utf8",
    input: JSON.stringify(input),
  })
  assert.equal(result.status, 0)
  const output = JSON.parse(result.stdout)
  const denial = JSON.parse(output.hookSpecificOutput.permissionDecisionReason)
  assert.equal(output.hookSpecificOutput.permissionDecision, "deny")
  assert.equal(denial.diagnostics[0].code, "CODEX_HOOK_PROTECTED_FILE")
  assert.equal(denial.diagnostics[0].repair_class, "NEVER_REPAIR")
})

test("the fixture is repo-local, synchronous, bounded, and incremental", async () => {
  const [configuration, implementation] = await Promise.all([
    readFile(config, "utf8"),
    readFile(hook, "utf8"),
  ])
  assert.match(configuration, /\^\(apply_patch\|Edit\|Write\)\$/)
  assert.doesNotMatch(configuration, /"async"/)
  assert.doesNotMatch(`${configuration}\n${implementation}`, /momi-check|scripts\/check|pnpm/)
  const started = performance.now()
  const result = spawnSync(process.execPath, [hook], {
    encoding: "utf8",
    input: JSON.stringify({
      ...shared,
      hook_event_name: "PostToolUse",
      tool_input: { command: "*** Update File: fixture/diagnostic.txt" },
      tool_response: { output: "Done!" },
    }),
  })
  assert.equal(result.status, 0)
  assert.ok(performance.now() - started < 5_000)
})

test("malformed hook input is reported as a command failure", () => {
  const result = spawnSync(process.execPath, [hook], {
    encoding: "utf8",
    input: "not-json",
  })
  assert.notEqual(result.status, 0)
})
