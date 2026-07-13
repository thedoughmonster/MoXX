import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const workflows = ["deploy-dev.yml", "deploy-prod.yml"]

for (const workflow of workflows) {
  test(`${workflow} derives database access from the permanent PAT`, async () => {
    const source = await readFile(
      new URL(`../.github/workflows/${workflow}`, import.meta.url),
      "utf8",
    )
    assert.match(
      source,
      /SUPABASE_DB_PASSWORD: \$\{\{ secrets\.SUPABASE_ACCESS_TOKEN \}\}/,
    )
    assert.doesNotMatch(source, /secrets\.SUPABASE_DB_PASSWORD/)
  })
}
