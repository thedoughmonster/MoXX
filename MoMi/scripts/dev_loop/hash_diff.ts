import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { hashGitDiff } from "./hash_git_diff.ts"
import { hashText } from "./hash_text.ts"
import { listChangedPaths } from "./list_changed_paths.ts"
import { runGit } from "./run_git.ts"

export async function hashDiff(
  baseSha: string,
  headSha: string,
  repositoryRoot = workspaceRoot,
): Promise<string> {
  const hash = createHash("sha256")
  await hashGitDiff(hash, [
    "diff", "--relative", "--binary", "--no-ext-diff", "--no-renames",
    `${baseSha}...${headSha}`, "--", ".",
  ], repositoryRoot)
  if (
    runGit(["rev-parse", "HEAD"], true, repositoryRoot) === headSha &&
    runGit(
      ["status", "--short", "--untracked-files=all", "--", "."],
      false,
      repositoryRoot,
    )
  ) {
    hash.update("\n")
    await hashGitDiff(hash, [
      "diff", "--relative", "--binary", "--no-ext-diff", headSha, "--", ".",
    ], repositoryRoot)
    for (const path of listChangedPaths(baseSha, headSha)) {
      const fullPath = join(repositoryRoot, path)
      if (existsSync(fullPath)) {
        hash.update(`\n${path}\0${hashText(readFileSync(fullPath, "utf8"))}`)
      }
    }
  }
  return hash.digest("hex")
}
