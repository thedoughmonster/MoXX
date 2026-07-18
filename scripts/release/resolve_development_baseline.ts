import { runCommand } from "./run_command.ts"
import type { WorkflowRun } from "./types.ts"

export function resolveDevelopmentBaseline(
  branch: string,
  headSha: string,
  devSha: string,
): string {
  const result = runCommand("gh", [
    "run", "list", "--workflow", "validate.yml", "--event", "push",
    "--branch", "dev", "--limit", "100",
    "--json", "databaseId,headSha,status,conclusion",
  ], { capture: true })
  const runs = JSON.parse(result.stdout) as WorkflowRun[]
  const successful = runs.filter((run) =>
    run.status === "completed" && run.conclusion === "success"
  )
  if (branch !== "dev") {
    if (!successful.some((run) => run.headSha === devSha)) {
      throw new Error("Current origin/dev has no successful push validation")
    }
    return devSha
  }
  for (const run of successful) {
    if (run.headSha === headSha) continue
    const ancestry = runCommand(
      "git",
      ["merge-base", "--is-ancestor", run.headSha, headSha],
      { capture: true, allowFailure: true },
    )
    if (ancestry.status === 0) return run.headSha
  }
  throw new Error("Unable to resolve the prior successful development validation")
}
