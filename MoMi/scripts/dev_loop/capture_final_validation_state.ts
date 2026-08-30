import { isAbsolute, relative, resolve, sep } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { resolveIdentity } from "./resolve_identity.ts"
import { runGit } from "./run_git.ts"
import type { FinalValidationState } from "./final_validation_types.ts"

export function captureFinalValidationState(
  baseRef: string,
  headRef: string,
  candidateRoot = workspaceRoot,
  productionRef = process.env.MOMI_PROD_REF ?? "origin/prod",
): FinalValidationState {
  const workspace = resolve(candidateRoot)
  const repository = resolve(runGit(["rev-parse", "--show-toplevel"], true, workspace))
  const workspacePath = relative(repository, workspace)
  if (workspacePath === ".." || workspacePath.startsWith(`..${sep}`) ||
    isAbsolute(workspacePath)) {
    throw new Error("Final validation workspace must be inside its Git repository")
  }
  const status = runGit(
    ["status", "--porcelain=v1", "--untracked-files=all"],
    false,
    repository,
  )
  if (status) {
    const first = status.split("\n")[0] ?? "unknown change"
    const action = first.startsWith("??")
      ? "remove or commit untracked files"
      : first[0] !== " " ? "commit or unstage indexed changes" : "commit or discard tracked changes"
    throw new Error(`Final validation requires a clean repository; ${action}: ${first.slice(3)}`)
  }
  const base = resolveIdentity(baseRef, repository)
  const head = resolveIdentity(headRef, repository)
  const production = resolveIdentity(productionRef, repository)
  const checkedOut = resolveIdentity("HEAD", repository)
  if (checkedOut.sha !== head.sha || checkedOut.tree !== head.tree) {
    throw new Error(
      `Final validation head must equal checked-out HEAD; checkout ${head.sha}`,
    )
  }
  return {
    repository_root: repository,
    workspace_root: workspace,
    base_ref: baseRef,
    head_ref: headRef,
    production_ref: productionRef,
    base,
    head,
    production,
  }
}
