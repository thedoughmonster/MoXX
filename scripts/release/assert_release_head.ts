import { runCommand } from "./run_command.ts"

export function assertReleaseHead(environment: "dev" | "prod"): string {
  runCommand("git", [
    "fetch", "origin",
    "dev:refs/remotes/origin/dev",
    "prod:refs/remotes/origin/prod",
  ])
  const status = runCommand("git", ["status", "--porcelain"], { capture: true })
  if (status.stdout.trim()) throw new Error("Release requires a clean worktree")
  const branch = runCommand("git", ["branch", "--show-current"], {
    capture: true,
  }).stdout.trim()
  if (branch !== "dev") throw new Error(`${environment} release must start from dev`)
  const head = runCommand("git", ["rev-parse", "HEAD"], { capture: true }).stdout.trim()
  const dev = runCommand("git", ["rev-parse", "origin/dev"], {
    capture: true,
  }).stdout.trim()
  if (head !== dev) throw new Error("Local dev must exactly match origin/dev")
  return head
}
