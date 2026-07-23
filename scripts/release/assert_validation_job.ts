import { findRequiredJob } from "./find_required_job.ts"
import { runCommand } from "./run_command.ts"
import type { ValidationReceipt } from "../dev_loop/types.ts"

export function assertValidationJob(receipt: ValidationReceipt): void {
  const runId = Number(receipt.run_log.run_id)
  const repository = process.env.GITHUB_REPOSITORY || runCommand(
    "gh",
    ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
    { capture: true },
  ).stdout.trim()
  const source = runCommand("gh", [
    "api", `repos/${repository}/actions/runs/${runId}`,
  ], { capture: true }).stdout
  const run = JSON.parse(source) as {
    head_sha?: string
    event?: string
    path?: string
  }
  if (
    run.head_sha !== receipt.identities.head_sha ||
    !["pull_request", "workflow_dispatch"].includes(run.event ?? "") ||
    run.path !== ".github/workflows/validate.yml"
  ) throw new Error("Validation receipt references the wrong workflow run")
  const job = findRequiredJob(runId, receipt.required_job)
  if (job?.status !== "completed" || job.conclusion !== "success") {
    throw new Error("Authoritative validation job did not succeed")
  }
}
