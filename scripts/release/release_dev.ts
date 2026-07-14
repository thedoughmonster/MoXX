import { applyMigrations } from "./apply_migrations.ts"
import { assertReleasePreflight } from "./assert_release_preflight.ts"
import { ensureDispatchedWorkflow } from "./ensure_dispatched_workflow.ts"
import { getOrCreatePullRequest } from "./get_or_create_pull_request.ts"
import { runCommand } from "./run_command.ts"
import { waitForPullRequest } from "./wait_for_pull_request.ts"
import { waitForWorkflow } from "./wait_for_workflow.ts"

export async function releaseDev(): Promise<void> {
  const preflight = assertReleasePreflight("dev")
  let releaseSha = preflight.headSha
  if (preflight.branch !== "dev") {
    console.log(`Publishing ${preflight.branch} for development...`)
    runCommand("git", ["push", "-u", "origin", preflight.branch])
    const pullRequest = getOrCreatePullRequest(
      "dev",
      preflight.branch,
      preflight.headSha,
      `Release ${preflight.branch} to development`,
      "Validates and releases this committed change through the MoMi coordinator.",
    )
    await waitForPullRequest(pullRequest.number)
    runCommand("gh", [
      "pr", "merge", String(pullRequest.number), "--merge", "--delete-branch",
      "--match-head-commit", preflight.headSha,
    ])
    runCommand("git", ["fetch", "origin", "dev:refs/remotes/origin/dev"])
    runCommand("git", ["switch", "dev"])
    runCommand("git", ["merge", "--ff-only", "origin/dev"])
    releaseSha = runCommand("git", ["rev-parse", "HEAD"], {
      capture: true,
    }).stdout.trim()
  }
  await waitForWorkflow("validate.yml", "push", releaseSha)
  await applyMigrations("dev")
  await ensureDispatchedWorkflow("deploy-dev.yml", "dev", releaseSha)
  console.log(`Development release complete at ${releaseSha}`)
}
