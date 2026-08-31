import { rmSync } from "node:fs"

import { runGit } from "./run_git.ts"

export function removeFinalValidationCheckout(
  sourceRepository: string,
  checkoutRepository: string,
): void {
  try {
    runGit([
      "worktree", "remove", "--force", checkoutRepository,
    ], true, sourceRepository)
  } finally {
    rmSync(checkoutRepository, { recursive: true, force: true })
    runGit(["worktree", "prune"], true, sourceRepository)
  }
}
