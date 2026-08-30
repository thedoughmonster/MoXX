import { pathToFileURL } from "node:url"

const repository = "thedoughmonster/MoXX"
const workflow = ".github/workflows/supabase-credential-preflight.yml"

export function assertSupabasePreflightAuthority(runtime) {
  const environment = runtime.MOXX_TARGET_ENVIRONMENT
  if (environment !== "dev" && environment !== "prod") {
    throw new Error("Unsupported Supabase preflight environment")
  }
  const branch = `refs/heads/${environment}`
  const workflowRef = `${repository}/${workflow}@${branch}`
  const mismatches = [
    [runtime.GITHUB_REPOSITORY, repository, "repository"],
    [runtime.GITHUB_EVENT_NAME, "workflow_dispatch", "event"],
    [runtime.GITHUB_REF, branch, "branch"],
    [runtime.GITHUB_WORKFLOW_REF, workflowRef, "workflow"],
  ].filter(([actual, expected]) => actual !== expected)
  if (mismatches.length > 0) {
    throw new Error(
      `Supabase preflight authority mismatch: ${mismatches.map((item) => item[2]).join(",")}`,
    )
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  assertSupabasePreflightAuthority(process.env)
}
