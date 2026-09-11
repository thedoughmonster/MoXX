import { constants, cpSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { dirname, join, relative } from "node:path"

import { runGit } from "./run_git.ts"
import type { FinalValidationState } from "./final_validation_types.ts"

export function createFinalValidationCheckout(
  source: FinalValidationState,
  checkoutRepository: string,
): FinalValidationState {
  rmSync(checkoutRepository, { recursive: true, force: true })
  mkdirSync(dirname(checkoutRepository), { recursive: true })
  runGit(["worktree", "prune"], true, source.repository_root)
  runGit([
    "worktree", "add", "--detach", checkoutRepository, source.head.sha,
  ], true, source.repository_root)
  try {
    const workspacePath = relative(source.repository_root, source.workspace_root)
    const checkoutWorkspace = join(checkoutRepository, workspacePath)
    const dependencies = join(source.workspace_root, "node_modules")
    const checkoutDependencies = join(checkoutWorkspace, "node_modules")
    if (existsSync(dependencies) && !existsSync(checkoutDependencies)) {
      cpSync(dependencies, checkoutDependencies, {
        recursive: true,
        preserveTimestamps: true,
        verbatimSymlinks: true,
        mode: constants.COPYFILE_FICLONE,
      })
    }
    mkdirSync(join(checkoutWorkspace, ".momi"), { recursive: true })
    return {
      ...source,
      repository_root: checkoutRepository,
      workspace_root: checkoutWorkspace,
      base_ref: source.base.sha,
      head_ref: source.head.sha,
      development_ref: source.development.sha,
      production_ref: source.production.sha,
    }
  } catch (error) {
    runGit([
      "worktree", "remove", "--force", checkoutRepository,
    ], true, source.repository_root)
    rmSync(checkoutRepository, { recursive: true, force: true })
    throw error
  }
}
