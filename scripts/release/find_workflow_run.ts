import { runCommand } from "./run_command.ts"
import type { WorkflowRun } from "./types.ts"

export function findWorkflowRun(
  workflow: string,
  event: "push" | "workflow_dispatch",
  headSha: string,
): WorkflowRun | undefined {
  const source = runCommand("gh", [
    "run", "list", "--workflow", workflow, "--event", event,
    "--limit", "30", "--json", "databaseId,headSha,status,conclusion",
  ], { capture: true }).stdout
  const runs = JSON.parse(source) as WorkflowRun[]
  return runs.find((run) => run.headSha === headSha)
}
