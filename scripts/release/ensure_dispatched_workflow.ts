import { findWorkflowRun } from "./find_workflow_run.ts"
import { runCommand } from "./run_command.ts"
import { waitForWorkflow } from "./wait_for_workflow.ts"

export async function ensureDispatchedWorkflow(
  workflow: string,
  ref: string,
  headSha: string,
): Promise<void> {
  const existing = findWorkflowRun(workflow, "workflow_dispatch", headSha)
  if (existing?.conclusion === "success") return
  if (existing && existing.status !== "completed") {
    await waitForWorkflow(workflow, "workflow_dispatch", headSha)
    return
  }
  runCommand("gh", [
    "workflow", "run", workflow, "--ref", ref,
    "-f", `expected_sha=${headSha}`,
  ])
  await waitForWorkflow(
    workflow,
    "workflow_dispatch",
    headSha,
    existing?.databaseId,
  )
}
