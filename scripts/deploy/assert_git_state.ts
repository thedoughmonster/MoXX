import { execFileSync } from "node:child_process"

export function assertGitState(environmentBranch: string): void {
  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" })
  if (status.trim()) throw new Error("Deployment requires a clean Git worktree")
  const branch = execFileSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
  }).trim()
  if (branch !== environmentBranch) {
    throw new Error(`Deployment requires branch ${environmentBranch}, found ${branch}`)
  }
  if (environmentBranch === "prod") {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
    const dev = execFileSync("git", ["rev-parse", "origin/dev"], {
      encoding: "utf8",
    }).trim()
    if (head !== dev) throw new Error("Production commit was not the verified dev commit")
  }
}
