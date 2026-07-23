import { runCommand } from "./run_command.ts"
import type { WorkflowJob } from "./types.ts"

export function findRequiredJob(
  runId: number,
  requiredName: string,
): WorkflowJob | undefined {
  const repository = process.env.GITHUB_REPOSITORY || runCommand(
    "gh",
    ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
    { capture: true },
  ).stdout.trim()
  const output = runCommand("gh", [
    "api", `repos/${repository}/actions/runs/${runId}/jobs?per_page=100`,
  ], { capture: true }).stdout
  const jobs = (JSON.parse(output) as { jobs?: WorkflowJob[] }).jobs ?? []
  const matches = jobs.filter((job) => job.name === requiredName)
  if (matches.length > 1) throw new Error(`Multiple jobs named ${requiredName}`)
  return matches[0]
}
