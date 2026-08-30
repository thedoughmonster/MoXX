import { resolveIdentity } from "./resolve_identity.ts"
import { runGit } from "./run_git.ts"
import type { FinalValidationState } from "./final_validation_types.ts"

export function assertFinalValidationState(state: FinalValidationState): void {
  const status = runGit(
    ["status", "--porcelain=v1", "--untracked-files=all"],
    false,
    state.repository_root,
  )
  if (status) {
    throw new Error(
      "Final validation repository changed during checks; restore the clean committed HEAD and rerun",
    )
  }
  const base = resolveIdentity(state.base_ref, state.repository_root)
  const head = resolveIdentity(state.head_ref, state.repository_root)
  const production = resolveIdentity(state.production_ref, state.repository_root)
  const checkedOut = resolveIdentity("HEAD", state.repository_root)
  if (base.sha !== state.base.sha || base.tree !== state.base.tree) {
    throw new Error("Final validation base ref moved during checks; rerun with the resolved base SHA")
  }
  if (head.sha !== state.head.sha || head.tree !== state.head.tree) {
    throw new Error("Final validation head ref moved during checks; rerun with the resolved head SHA")
  }
  if (production.sha !== state.production.sha ||
    production.tree !== state.production.tree) {
    throw new Error(
      "Final validation production ref moved during checks; rerun from fresh refs",
    )
  }
  if (checkedOut.sha !== state.head.sha || checkedOut.tree !== state.head.tree) {
    throw new Error("Checked-out HEAD moved during final validation; restore the candidate SHA and rerun")
  }
}
