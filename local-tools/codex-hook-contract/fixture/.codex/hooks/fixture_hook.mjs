import { performance } from "node:perf_hooks"

const started = performance.now()
let source = ""
process.stdin.setEncoding("utf8")
for await (const chunk of process.stdin) source += chunk

const event = JSON.parse(source)
const command = event.tool_input?.command
if (typeof command !== "string") throw new Error("tool_input.command is required")

const protectedPath = "fixture/protected.txt"
const diagnosticPath = "fixture/diagnostic.txt"
const isProtected = command.includes(protectedPath)
const isDiagnostic = command.includes(diagnosticPath)
const elapsed = Number((performance.now() - started).toFixed(3))

if (event.hook_event_name === "PreToolUse" && isProtected) {
  const diagnostic = {
    code: "CODEX_HOOK_PROTECTED_FILE",
    path: protectedPath,
    severity: "error",
    evidence: { event: "PreToolUse", tool_name: event.tool_name, hook_runtime_ms: elapsed },
    repair_class: "NEVER_REPAIR",
  }
  process.stdout.write(JSON.stringify({
    systemMessage: JSON.stringify({ diagnostics: [diagnostic] }),
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: JSON.stringify({ diagnostics: [diagnostic] }),
    },
  }))
} else if (event.hook_event_name === "PostToolUse" && isDiagnostic) {
  const diagnostic = {
    code: "CODEX_HOOK_CONTRACT_FIXTURE",
    path: diagnosticPath,
    severity: "error",
    evidence: { event: "PostToolUse", tool_name: event.tool_name, hook_runtime_ms: elapsed },
    repair_class: "SEMANTIC_REPAIR",
  }
  process.stdout.write(JSON.stringify({
    systemMessage: "Codex edit-event contract fixture produced one diagnostic.",
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: JSON.stringify({ diagnostics: [diagnostic] }),
    },
  }))
}
