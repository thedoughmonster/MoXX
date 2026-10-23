import { spawnSync } from "node:child_process"

import { gitRepositoryRoot, productSourceCommit } from
  "../git_product_layout.ts"

export function loadDevelopmentMigrationChanges(
  migrationPath: string,
): string {
  const developmentRef = process.env.MOMI_DEV_REF ?? "origin/dev"
  const productionRef = process.env.MOMI_PROD_REF ?? "origin/prod"
  if (developmentRef !== "origin/dev" &&
    !/^[0-9a-f]{40}$/.test(developmentRef)) {
    throw new Error("MOMI_DEV_REF must be origin/dev or a full commit SHA")
  }
  if (productionRef !== "origin/prod" &&
    !/^[0-9a-f]{40}$/.test(productionRef)) {
    throw new Error("MOMI_PROD_REF must be origin/prod or a full commit SHA")
  }
  const productionSource = productSourceCommit(productionRef)
  const developmentSource = productSourceCommit(developmentRef)
  const result = spawnSync("git", [
    "log", "--reverse", "--first-parent", "--diff-merges=first-parent",
    "--format=commit:%H", "--raw", "--abbrev=40", "--no-renames",
    `${productionSource}..${developmentSource}`, "--", migrationPath,
  ], {
    cwd: gitRepositoryRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw result.error ?? new Error("Unable to read development migration history")
  }
  return result.stdout
}
