import { runGit } from "./run_git.ts"

export function listChangedPaths(baseSha: string, headSha: string): string[] {
  const output = runGit([
    "diff", "--name-only", "--no-renames", `${baseSha}...${headSha}`, "--",
  ])
  const paths = new Set(output ? output.split("\n").filter(Boolean) : [])
  if (runGit(["rev-parse", "HEAD"]) === headSha) {
    const status = runGit(
      ["status", "--porcelain=v1", "--untracked-files=all"],
      false,
    )
    for (const line of status.split("\n").filter(Boolean)) {
      const path = line.slice(3).split(" -> ").at(-1)
      if (path) paths.add(path)
    }
  }
  return [...paths].sort()
}
