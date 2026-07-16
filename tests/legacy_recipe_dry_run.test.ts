import assert from "node:assert/strict"
import { access } from "node:fs/promises"
import test from "node:test"

import { loadPackage } from
  "../local-tools/legacy-recipe-import/load_package.ts"
import { planRoot } from
  "../local-tools/legacy-recipe-import/plan_root.ts"
import { run } from "../local-tools/legacy-recipe-import/run.ts"
import { createLegacyRecipeTestPackage } from "./legacy_recipe_test_package.ts"

test("dry run emits SQL without reading PostgreSQL credentials", async () => {
  const fixture = await createLegacyRecipeTestPackage()
  const previous = new Map([
    "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD",
  ].map((key) => [key, process.env[key]]))
  for (const key of previous.keys()) delete process.env[key]
  try {
    await run([
      "--env", "dev",
      "--project-ref", "xtbraqnlskmqxinjxxdn",
      "--source", fixture.root,
    ], fixture.trust)
    const pkg = await loadPackage(fixture.root, fixture.trust)
    await assert.doesNotReject(access(`${planRoot()}\\${pkg.importRunId}\\plan.json`))
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
