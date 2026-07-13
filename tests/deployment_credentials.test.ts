import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const workflows = ["deploy-dev.yml", "deploy-prod.yml"]

for (const workflow of workflows) {
  test(`${workflow} does not request database credentials`, async () => {
    const source = await readFile(
      new URL(`../.github/workflows/${workflow}`, import.meta.url),
      "utf8",
    )
    assert.match(source, /SUPABASE_ACCESS_TOKEN/)
    assert.doesNotMatch(source, /SUPABASE_DB_PASSWORD/)
  })
}

for (const script of ["run_deploy_plan.ts", "run_deploy_apply.ts"]) {
  test(`${script} keeps automated migrations paused`, async () => {
    const source = await readFile(new URL(`../scripts/${script}`, import.meta.url), "utf8")
    assert.doesNotMatch(source, /planMigrations|applyMigrations/)
    assert.match(source, /requireCredentials\(false\)/)
  })
}
