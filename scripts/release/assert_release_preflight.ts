import type { EnvironmentKey } from "../deploy/types.ts"
import { runSupabase } from "../deploy/run_supabase.ts"
import { runCommand } from "./run_command.ts"
import type { ReleasePreflight } from "./types.ts"

export function assertReleasePreflight(
  environment: EnvironmentKey,
): ReleasePreflight {
  if (!process.versions.node.startsWith("24.")) {
    throw new Error(`Node 24 is required; found ${process.versions.node}`)
  }
  const clean = runCommand("git", ["status", "--porcelain"], { capture: true })
  if (clean.stdout.trim()) throw new Error("Commit or remove local changes first")
  const branch = runCommand("git", ["branch", "--show-current"], {
    capture: true,
  }).stdout.trim()
  if (!branch || branch === "prod") throw new Error("Never release from prod")
  if (environment === "prod" && branch !== "dev") {
    throw new Error("Production releases must start from dev")
  }
  runCommand("gh", ["auth", "status"])
  runSupabase(["projects", "list", "--output", "json"], true)
  runCommand("git", [
    "fetch",
    "origin",
    "dev:refs/remotes/origin/dev",
    "prod:refs/remotes/origin/prod",
  ])
  const headSha = runCommand("git", ["rev-parse", "HEAD"], {
    capture: true,
  }).stdout.trim()
  const devSha = runCommand("git", ["rev-parse", "origin/dev"], {
    capture: true,
  }).stdout.trim()
  if (branch === "dev" && headSha !== devSha) {
    throw new Error("Local dev must exactly match origin/dev")
  }
  if (branch !== "dev") {
    const ancestry = runCommand(
      "git",
      ["merge-base", "--is-ancestor", "origin/dev", "HEAD"],
      { capture: true, allowFailure: true },
    )
    if (ancestry.status !== 0) throw new Error("Feature branch must include current dev")
  }
  runCommand(process.execPath, ["scripts/check.ts", "--service", "all"])
  return { environment, branch, headSha }
}
