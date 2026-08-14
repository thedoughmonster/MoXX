import { findWorkflowRun } from "./find_workflow_run.ts"
import { findRequiredJob } from "./find_required_job.ts"
import { runCommand } from "./run_command.ts"
import type { WorkflowRun } from "./types.ts"
import { waitForWorkflow } from "./wait_for_workflow.ts"

export async function ensureDispatchedWorkflow(
  workflow: string,
  ref: string,
  headSha: string,
  requiredJob: string,
  inputs: Record<string, string>,
): Promise<WorkflowRun> {
  const identity = inputs.release_identity ?? inputs.plan_sha256 ??
    inputs.dev_receipt_sha256
  if (!/^[0-9a-f]{64}$/.test(identity ?? "")) {
    throw new Error("Workflow dispatch requires an exact receipt or plan digest")
  }
  const existing = findWorkflowRun(
    workflow,
    "workflow_dispatch",
    headSha,
    identity,
  )
  const job = existing && findRequiredJob(existing.databaseId, requiredJob)
  if (existing && job?.status === "completed" && job.conclusion === "success") {
    return existing
  }
  if (existing && existing.status !== "completed") {
    return await waitForWorkflow(workflow, headSha, requiredJob, identity)
  }
  const args = ["workflow", "run", workflow, "--ref", ref]
  for (const [name, value] of Object.entries(inputs).sort()) {
    args.push("-f", `${name}=${value}`)
  }
  runCommand("gh", args)
  return await waitForWorkflow(
    workflow,
    headSha,
    requiredJob,
    identity,
    existing?.databaseId,
  )
}
