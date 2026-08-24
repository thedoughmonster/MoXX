import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import {
  hookAdditionalContextLimit,
  renderHookOutput,
} from "../scripts/codex_hooks/render_hook_output.ts"
import { runPostWriteDiagnostics } from
  "../scripts/codex_hooks/run_post_write_diagnostics.ts"
import { sourceQualityDiagnostic } from
  "../scripts/diagnostics/source_quality_diagnostic.ts"

const policies = { max_handwritten_lines: 120, hard_max_handwritten_lines: 140 }

test("injects compact same-session context without full validation calls", async () => {
  const finding = {
    code: "SOURCE_HANDWRITTEN_LINE_LIMIT" as const,
    path: "notes/soft.md",
    severity: "advisory" as const,
    message: "notes/soft.md: 121 lines (soft limit 120)",
    repair_class: "BOUNDED_REFACTOR" as const,
    actual: 121,
    limit: 120,
  }
  const output = renderHookOutput([{
    code: "SOURCE_HANDWRITTEN_LINE_LIMIT",
    path: "notes/soft.md",
    severity: "advisory",
    evidence: { actual: 121, limit: 120 },
    repair_class: "BOUNDED_REFACTOR",
    repository_diagnostic: sourceQualityDiagnostic(finding),
  }]) as { hookSpecificOutput: { additionalContext: string } }
  const context = JSON.parse(output.hookSpecificOutput.additionalContext)
  assert.match(context.rendered_diagnostics, /notes\/soft\.md/u)
  assert.match(context.rendered_diagnostics, /fix: none/u)
  assert.deepEqual(context.unadapted_diagnostics, [])
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

test("groups locations and bounds larger hook context", async () => {
  const diagnostics = Array.from({ length: 40 }, (_, index) => {
    const path = index === 39
      ? `notes/${"long-path-".repeat(500)}.md`
      : `notes/soft-${index}.md`
    const finding = {
      code: "SOURCE_HANDWRITTEN_LINE_LIMIT" as const,
      path,
      severity: "advisory" as const,
      message: `${path}: 121 lines (soft limit 120)`,
      repair_class: "BOUNDED_REFACTOR" as const,
      actual: 121,
      limit: 120,
    }
    return {
      code: finding.code,
      path,
      severity: finding.severity,
      evidence: { actual: 121, limit: 120 },
      repair_class: finding.repair_class,
      repository_diagnostic: sourceQualityDiagnostic(finding),
    }
  })
  const output = renderHookOutput(diagnostics.slice(0, 8)) as {
    hookSpecificOutput: { additionalContext: string }
  }
  const serialized = output.hookSpecificOutput.additionalContext
  const rendered = JSON.parse(serialized).rendered_diagnostics
  const hooks = JSON.parse(await readFile(
    join(workspaceRoot, ".codex", "hooks.json"), "utf8",
  ))
  const configuredLimit = hooks.hooks.PostToolUse[0].hooks[0].additionalContextLimit
  assert.equal(configuredLimit, hookAdditionalContextLimit)
  assert.ok(serialized.length <= configuredLimit)
  assert.match(rendered, /8 instances/u)
  for (const diagnostic of diagnostics.slice(0, 8)) assert.match(rendered, new RegExp(
    diagnostic.path.replace(".", "\\."), "u",
  ))
  const largeOutput = renderHookOutput(diagnostics) as {
    hookSpecificOutput: { additionalContext: string }
  }
  const largeSerialized = largeOutput.hookSpecificOutput.additionalContext
  const largeContext = JSON.parse(largeSerialized)
  assert.ok(largeSerialized.length <= configuredLimit)
  assert.equal(largeContext.truncation.limit, configuredLimit)
  assert.match(largeContext.rendered_diagnostics, /\[truncated:/u)
  const nativeOutput = renderHookOutput(diagnostics.map((item) => ({
    ...item, repository_diagnostic: undefined,
  }))) as { hookSpecificOutput: { additionalContext: string } }
  const nativeSerialized = nativeOutput.hookSpecificOutput.additionalContext
  const nativeContext = JSON.parse(nativeSerialized)
  assert.ok(nativeSerialized.length <= configuredLimit)
  assert.equal(nativeContext.truncation.unadapted_count, diagnostics.length)
  assert.equal(nativeContext.truncation.details_omitted, true)
  assert.match(nativeContext.rendered_diagnostics, /hook-only diagnostic details omitted/u)
  assert.doesNotMatch(nativeContext.rendered_diagnostics, /complete diagnostics/u)
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
