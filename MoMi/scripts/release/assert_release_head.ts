import { runCommand } from "./run_command.ts"

export function assertReleaseHead(
  environment: "dev" | "prod",
  command: typeof runCommand = runCommand,
): string {
  command("git", [
    "fetch", "origin",
    "refs/heads/dev:refs/remotes/origin/dev",
    "refs/heads/prod:refs/remotes/origin/prod",
  ])
  const status = command("git", ["status", "--porcelain"], { capture: true })
  if (status.stdout.trim()) throw new Error("Release requires a clean worktree")
  const branch = command("git", ["branch", "--show-current"], {
    capture: true,
  }).stdout.trim()
  if (branch !== "dev") throw new Error(`${environment} release must start from dev`)
  const head = command("git", ["rev-parse", "HEAD"], { capture: true }).stdout.trim()
  const dev = command("git", ["rev-parse", "origin/dev"], {
    capture: true,
  }).stdout.trim()
  if (head !== dev) throw new Error("Local dev must exactly match origin/dev")
  return head
}
