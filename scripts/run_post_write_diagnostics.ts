import { fileURLToPath } from "node:url"

import { loadWorkspace } from "./architecture/load_workspace.ts"
import { renderHookOutput } from "./codex_hooks/render_hook_output.ts"
import { runPostWriteDiagnostics } from "./codex_hooks/run_post_write_diagnostics.ts"
import type { HookEvent, PostWriteDiagnostic } from "./codex_hooks/types.ts"

let source = ""
process.stdin.setEncoding("utf8")
for await (const chunk of process.stdin) source += chunk

const root = fileURLToPath(new URL("../", import.meta.url))
let diagnostics: PostWriteDiagnostic[]
try {
  const event = JSON.parse(source) as HookEvent
  const workspace = await loadWorkspace()
  diagnostics = await runPostWriteDiagnostics(event, {
    policies: workspace.policies,
    root,
  })
} catch (error) {
  diagnostics = [{
    code: "POST_WRITE_HOOK_FAILURE",
    path: "(hook)",
    severity: "error",
    evidence: {
      message: (error instanceof Error ? error.message : String(error)).slice(0, 500),
    },
    repair_class: "SEMANTIC_REPAIR",
  }]
}

const output = renderHookOutput(diagnostics)
if (output !== null) process.stdout.write(JSON.stringify(output))
