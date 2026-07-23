import { runCommand } from "./run_command.ts"
import type { WorkflowRun } from "./types.ts"

export function findWorkflowRun(
  workflow: string,
  event: "push" | "workflow_dispatch",
  headSha: string,
  identity?: string,
): WorkflowRun | undefined {
  const arguments_ = [
    "run", "list", "--workflow", workflow, "--event", event,
    "--limit", "30",
    "--json", "databaseId,headSha,status,conclusion,displayTitle",
  ]
  const source = runCommand("gh", arguments_, { capture: true }).stdout
  const runs = JSON.parse(source) as WorkflowRun[]
  return runs.find((run) =>
    run.headSha === headSha &&
    (!identity || run.displayTitle?.includes(identity))
  )
}
