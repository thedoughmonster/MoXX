import { spawnSync } from "node:child_process"

import { parseProductionMigrationTree } from
  "./parse_production_migration_tree.ts"

export function loadDevelopmentMigrations(
  migrationPath: string,
): Map<string, string> {
  const ref = process.env.MOMI_DEV_REF ?? "origin/dev"
  if (ref !== "origin/dev" && !/^[0-9a-f]{40}$/.test(ref)) {
    throw new Error("MOMI_DEV_REF must be origin/dev or a full commit SHA")
  }
  if (/^0+$/.test(ref)) throw new Error("MOMI_DEV_REF cannot be the zero SHA")
  const ancestry = spawnSync("git", ["merge-base", "--is-ancestor", ref, "HEAD"])
  if (ancestry.status !== 0) {
    throw new Error("MOMI_DEV_REF must be an ancestor of HEAD")
  }
  const result = spawnSync(
    "git",
    ["ls-tree", "-r", ref, "--", migrationPath],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  )
  if (result.status !== 0 || !result.stdout) {
    throw new Error("Unable to read the development migration baseline")
  }
  return parseProductionMigrationTree(result.stdout, migrationPath)
}
