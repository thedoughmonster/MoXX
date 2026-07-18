import { applyMigrations } from "./apply_migrations.ts"
import { assertReleasePreflight } from "./assert_release_preflight.ts"
import { ensureDispatchedWorkflow } from "./ensure_dispatched_workflow.ts"
import { getOrCreatePullRequest } from "./get_or_create_pull_request.ts"
import { runCommand } from "./run_command.ts"
import { waitForPullRequest } from "./wait_for_pull_request.ts"
import { waitForWorkflow } from "./wait_for_workflow.ts"

export async function releaseProd(): Promise<void> {
  const preflight = assertReleasePreflight("prod")
  const productionBefore = runCommand("git", ["rev-parse", "origin/prod"], {
    capture: true,
  }).stdout.trim()
  if (productionBefore !== preflight.headSha) {
    const pullRequest = getOrCreatePullRequest(
      "prod",
      "dev",
      preflight.headSha,
      "Promote development to production",
      "Promotes the exact development commit after checks and database migration.",
    )
    await waitForPullRequest(pullRequest.number)
  }
  await waitForWorkflow(
    "validate.yml", "push", preflight.headSha, undefined, "dev",
  )
  await applyMigrations("prod")
  if (productionBefore !== preflight.headSha) {
    await ensureDispatchedWorkflow(
      "promote-prod.yml",
      "dev",
      preflight.headSha,
    )
  }
  runCommand("git", ["fetch", "origin", "prod:refs/remotes/origin/prod"])
  const productionSha = runCommand("git", ["rev-parse", "origin/prod"], {
    capture: true,
  }).stdout.trim()
  if (productionSha !== preflight.headSha) {
    throw new Error("Production did not reach the approved development commit")
  }
  await waitForWorkflow(
    "validate.yml", "push", preflight.headSha, undefined, "prod",
  )
  await ensureDispatchedWorkflow("deploy-prod.yml", "prod", preflight.headSha)
  console.log(`Production release complete at ${productionSha}`)
}
