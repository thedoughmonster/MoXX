import { runCommand } from "./run_command.ts"
import type { WorkflowRun } from "./types.ts"

export function findWorkflowRun(
  workflow: string,
  event: "push" | "workflow_dispatch",
  headSha: string,
  branch?: string,
): WorkflowRun | undefined {
  const arguments_ = [
    "run", "list", "--workflow", workflow, "--event", event,
    "--limit", "30", "--json", "databaseId,headSha,status,conclusion",
  ]
  if (branch) arguments_.push("--branch", branch)
  const source = runCommand("gh", arguments_, { capture: true }).stdout
  const runs = JSON.parse(source) as WorkflowRun[]
  return runs.find((run) => run.headSha === headSha)
}
