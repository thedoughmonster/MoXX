import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { loadWorkspace } from "./architecture/load_workspace.ts"
import { renderHookOutput } from "./codex_hooks/render_hook_output.ts"
import { runPostWriteDiagnostics } from "./codex_hooks/run_post_write_diagnostics.ts"
import type { HookEvent, PostWriteDiagnostic } from "./codex_hooks/types.ts"

const root = fileURLToPath(new URL("../", import.meta.url))
export async function runPostWriteHook(source: string): Promise<string | undefined> {
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
  return output === null ? undefined : JSON.stringify(output)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let source = ""
  process.stdin.setEncoding("utf8")
  for await (const chunk of process.stdin) source += chunk
  const output = await runPostWriteHook(source)
  if (output) process.stdout.write(output)
}
