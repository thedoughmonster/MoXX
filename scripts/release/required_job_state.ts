import type { WorkflowJob, WorkflowRun } from "./types.ts"

export function requiredJobState(
  run: WorkflowRun,
  job: WorkflowJob | undefined,
): "success" | "wait" {
  if (job?.status === "completed") {
    if (job.conclusion !== "success") {
      throw new Error(`${job.name} concluded ${job.conclusion ?? "without success"}`)
    }
    return "success"
  }
  if (run.status === "completed" && !job) {
    throw new Error("Workflow completed without the required job")
  }
  return "wait"
}
