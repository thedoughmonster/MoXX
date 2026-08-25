import { spawnSync } from "node:child_process"

import { parseProductionMigrationTree } from
  "./parse_production_migration_tree.ts"
import { gitRepositoryRoot, productPathAtRef } from
  "../git_product_layout.ts"

export function loadProductionMigrations(
  migrationPath: string,
): Map<string, string> {
  const requested = process.env.MOMI_PROD_REF
  if (requested && requested !== "origin/prod") {
    throw new Error("MOMI_PROD_REF must be origin/prod")
  }
  const repositoryPath = productPathAtRef("origin/prod", migrationPath)
  const result = spawnSync(
    "git",
    ["ls-tree", "-r", "origin/prod", "--", repositoryPath],
    { cwd: gitRepositoryRoot, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  )
  if (result.status !== 0 || !result.stdout) {
    throw result.error ?? new Error("Unable to read the production migration baseline")
  }
  return parseProductionMigrationTree(result.stdout, repositoryPath)
}
