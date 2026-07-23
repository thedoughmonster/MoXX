import { setTimeout as sleep } from "node:timers/promises"

import { findRequiredJob } from "./find_required_job.ts"
import { findWorkflowRun } from "./find_workflow_run.ts"
import { requiredJobState } from "./required_job_state.ts"
import type { WorkflowRun } from "./types.ts"

export async function waitForWorkflow(
  workflow: string,
  headSha: string,
  requiredJob: string,
  identity: string,
  ignoredRunId?: number,
): Promise<WorkflowRun> {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const run = findWorkflowRun(workflow, "workflow_dispatch", headSha, identity)
    if (!run || run.databaseId === ignoredRunId) {
      await sleep(2000)
      continue
    }
    const job = findRequiredJob(run.databaseId, requiredJob)
    if (requiredJobState(run, job) === "success") return run
    await sleep(2000)
  }
  throw new Error(`Timed out waiting for ${requiredJob} at ${headSha}`)
}
