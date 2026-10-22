import { runCommand } from "../run_command.ts"

export function readSuccessfulRetentionRun(
  runId: number, sha: string, kind: "validation" | "development",
  command: typeof runCommand = runCommand,
) {
  const prefix = "repos/thedoughmonster/MoXX/actions/runs/"
  const run = JSON.parse(command("gh", ["api", `${prefix}${runId}`], { capture: true }).stdout)
  const jobs = JSON.parse(command("gh", ["api", `${prefix}${runId}/jobs?per_page=100`],
    { capture: true }).stdout).jobs as { name: string; conclusion: string; status: string }[]
  const workflow = kind === "development" ? ".github/workflows/deploy-dev.yml"
    : ".github/workflows/monorepo-routing.yml"
  const names = kind === "development" ? ["deploy"]
    : ["selected-backend-validation / validate-final", "product-validation"]
  if (run.repository?.full_name !== "thedoughmonster/MoXX" || run.head_sha !== sha ||
      run.path !== workflow || run.status !== "completed" || run.conclusion !== "success" ||
      (kind === "development" ? run.event !== "workflow_dispatch" || run.head_branch !== "dev"
        : run.event !== "pull_request") || !Number.isSafeInteger(run.run_attempt) ||
      names.some((name) => jobs.filter((job) => job.name === name &&
        job.status === "completed" && job.conclusion === "success").length !== 1)) {
    throw new Error("Retention evidence is not from the exact successful workflow")
  }
  return run as { run_attempt: number }
}
