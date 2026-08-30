export type GitIdentity = { ref: string; sha: string; tree: string }

export type FinalValidationState = {
  repository_root: string
  workspace_root: string
  base_ref: string
  head_ref: string
  production_ref: string
  base: GitIdentity
  head: GitIdentity
  production: GitIdentity
}

export type CheckExecutionBinding = {
  environment?: NodeJS.ProcessEnv
  assert_invariants?: () => void
}
