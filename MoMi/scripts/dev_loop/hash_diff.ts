import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { hashText } from "./hash_text.ts"
import { listChangedPaths } from "./list_changed_paths.ts"
import { runGit } from "./run_git.ts"

export function hashDiff(baseSha: string, headSha: string): string {
  let patch = runGit([
    "diff", "--relative", "--binary", "--no-ext-diff", "--no-renames",
    `${baseSha}...${headSha}`, "--", ".",
  ])
  if (
    runGit(["rev-parse", "HEAD"]) === headSha &&
    runGit(["status", "--short", "--untracked-files=all", "--", "."], false)
  ) {
    patch += `\n${runGit([
      "diff", "--relative", "--binary", "--no-ext-diff", headSha, "--", ".",
    ])}`
    for (const path of listChangedPaths(baseSha, headSha)) {
      const fullPath = join(workspaceRoot, path)
      if (existsSync(fullPath)) {
        patch += `\n${path}\0${hashText(readFileSync(fullPath, "utf8"))}`
      }
    }
  }
  return hashText(patch)
}
