import { runGit } from "./run_git.ts"

export function resolveIdentity(ref: string): { ref: string; sha: string; tree: string } {
  if (!ref || ref.startsWith("-")) throw new Error("Git ref is required")
  const sha = runGit(["rev-parse", "--verify", `${ref}^{commit}`])
  const tree = runGit(["rev-parse", "--verify", `${sha}^{tree}`])
  return { ref, sha, tree }
}
