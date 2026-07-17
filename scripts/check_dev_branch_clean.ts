import { spawnSync } from "node:child_process"

const branch = spawnSync("git", ["branch", "--show-current"], {
  encoding: "utf8",
})
if (branch.status !== 0) {
  throw new Error("Unable to determine current branch.")
}

const currentBranch = branch.stdout.trim()
if (currentBranch !== "dev") {
  console.log(`Dev branch cleanliness guard skipped on ${currentBranch || "detached HEAD"}.`)
  process.exit(0)
}

const status = spawnSync("git", ["status", "--porcelain"], {
  encoding: "utf8",
})
if (status.status !== 0) {
  throw new Error("Unable to inspect dev worktree status.")
}

if (status.stdout.trim().length > 0) {
  throw new Error(
    "The dev branch is dirty. Move work to a feature branch or feature worktree.",
  )
}

console.log("Dev branch cleanliness guard passed.")
