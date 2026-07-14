import { setTimeout as sleep } from "node:timers/promises"

import { findWorkflowRun } from "./find_workflow_run.ts"
import { runCommand } from "./run_command.ts"
import type { WorkflowRun } from "./types.ts"

export async function waitForWorkflow(
  workflow: string,
  event: "push" | "workflow_dispatch",
  headSha: string,
  ignoredRunId?: number,
): Promise<WorkflowRun> {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const run = findWorkflowRun(workflow, event, headSha)
    if (!run || run.databaseId === ignoredRunId) {
      await sleep(2000)
      continue
    }
    if (run.status === "completed") {
      if (run.conclusion !== "success") {
        throw new Error(`${workflow} concluded ${run.conclusion ?? "without success"}`)
      }
      return run
    }
    runCommand("gh", ["run", "watch", String(run.databaseId), "--exit-status"])
    const completed = findWorkflowRun(workflow, event, headSha)
    if (!completed || completed.conclusion !== "success") {
      throw new Error(`${workflow} did not complete successfully`)
    }
    return completed
  }
  throw new Error(`Timed out waiting for ${workflow} at ${headSha}`)
}
