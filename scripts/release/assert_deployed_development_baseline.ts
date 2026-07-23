import { findWorkflowRun } from "./find_workflow_run.ts"

export function assertDeployedDevelopmentBaseline(headSha: string): void {
  const run = findWorkflowRun(
    "deploy-dev.yml",
    "workflow_dispatch",
    headSha,
    "dev",
  )
  if (!run || run.status !== "completed" || run.conclusion !== "success") {
    throw new Error(
      "Migration-free release requires a successfully deployed development baseline",
    )
  }
}
