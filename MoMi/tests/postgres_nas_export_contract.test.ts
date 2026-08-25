import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("exposes the manual local database commands", async () => {
  const source = await readFile(new URL("../package.json", import.meta.url), "utf8")
  const scripts = (JSON.parse(source) as { scripts: Record<string, string> }).scripts
  assert.equal(scripts["local:db-export"],
    "node local-tools/postgres-nas-export/export.ts")
  assert.equal(scripts["local:db-verify"],
    "node local-tools/postgres-nas-export/verify.ts")
  assert.equal(scripts["local:db-restore-drill"],
    "node local-tools/postgres-nas-export/restore_drill.ts")
  assert.equal(scripts["local:legacy-recipe-import"],
    "node local-tools/legacy-recipe-import/main.ts")
})

test("ignores database dumps and local export control state", async () => {
  const source = await readFile(new URL("../.gitignore", import.meta.url), "utf8")
  assert.match(source, /^\.momi-postgres-export\/$/m)
  assert.match(source, /^\.momi-postgres-export\.lock$/m)
  assert.match(source, /^\*\.pgdump$/m)
  assert.match(source, /^\*\.dump$/m)
})

test("keeps the capability Windows-native and local-only", async () => {
  const files = ["run_export.ts", "run_verify.ts", "run_restore_drill.ts", "run_process.ts"]
  for (const file of files) {
    const source = await readFile(
      new URL(`../local-tools/postgres-nas-export/${file}`, import.meta.url),
      "utf8",
    )
    assert.doesNotMatch(source, /docker|wsl|fetch\(|https?:\/\//i)
  }
})
