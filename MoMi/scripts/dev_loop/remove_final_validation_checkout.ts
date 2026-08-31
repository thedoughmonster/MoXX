import { existsSync, rmSync } from "node:fs"

import { runGit } from "./run_git.ts"
import { setFinalValidationCheckoutWritable } from
  "./set_final_validation_checkout_writable.ts"

export function removeFinalValidationCheckout(
  sourceRepository: string,
  checkoutRepository: string,
): void {
  if (existsSync(checkoutRepository)) {
    setFinalValidationCheckoutWritable(checkoutRepository, [], true)
  }
  try {
    runGit([
      "worktree", "remove", "--force", checkoutRepository,
    ], true, sourceRepository)
  } finally {
    rmSync(checkoutRepository, { recursive: true, force: true })
    runGit(["worktree", "prune"], true, sourceRepository)
  }
}
