import { spawnSync } from "node:child_process"

const result = spawnSync(process.execPath, [
  "--test", "tests/legacy_recipe_postgres_integration.test.ts",
], {
  cwd: process.cwd(), stdio: "inherit",
  env: { ...process.env, MOMI_LEGACY_RECIPE_PG_INTEGRATION: "1" },
})
process.exit(result.status ?? 1)
