import { workspaceRoot } from "../architecture/paths.ts"
import { runGit } from "./run_git.ts"

export function resolveIdentity(
  ref: string,
  cwd = workspaceRoot,
): { ref: string; sha: string; tree: string } {
  if (!ref || ref.startsWith("-")) throw new Error("Git ref is required")
  const sha = runGit(["rev-parse", "--verify", `${ref}^{commit}`], true, cwd)
  const tree = runGit(["rev-parse", "--verify", `${sha}^{tree}`], true, cwd)
  return { ref, sha, tree }
}
