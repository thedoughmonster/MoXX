import { spawnSync } from "node:child_process"

import { parseProductionMigrationTree } from
  "./parse_production_migration_tree.ts"
import { gitRepositoryRoot, productPathAtRef } from
  "../git_product_layout.ts"

export function loadProductionMigrations(
  migrationPath: string,
): Map<string, string> {
  const requested = process.env.MOMI_PROD_REF
  const ref = requested ?? "origin/prod"
  if (ref !== "origin/prod" && !/^[0-9a-f]{40}$/u.test(ref)) {
    throw new Error("MOMI_PROD_REF must be origin/prod or a full commit SHA")
  }
  const repositoryPath = productPathAtRef(ref, migrationPath)
  const result = spawnSync(
    "git",
    ["ls-tree", "-r", ref, "--", repositoryPath],
    { cwd: gitRepositoryRoot, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  )
  if (result.status !== 0 || !result.stdout) {
    throw result.error ?? new Error("Unable to read the production migration baseline")
  }
  return parseProductionMigrationTree(result.stdout, repositoryPath)
}
