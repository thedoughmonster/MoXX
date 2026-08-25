import assert from "node:assert/strict"
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { loadLocalMigrations } from
  "../scripts/migrations/load_local_migrations.ts"
import { parseProductionMigrationTree } from
  "../scripts/migrations/parse_production_migration_tree.ts"

test("rejects symlink and executable migration files", {
  skip: process.platform === "win32",
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "momi-migrations-"))
  t.after(async () => await rm(root, { recursive: true, force: true }))
  const target = join(root, "target.txt")
  const linked = join(root, "001_linked.sql")
  await writeFile(target, "select 1;\n")
  await symlink(target, linked)
  await assert.rejects(
    () => loadLocalMigrations(root),
    /001_linked\.sql: migration must be a regular file/,
  )
  await rm(linked)
  const executable = join(root, "002_executable.sql")
  await writeFile(executable, "select 2;\n")
  await chmod(executable, 0o755)
  await assert.rejects(
    () => loadLocalMigrations(root),
    /002_executable\.sql: migration must not be executable/,
  )
})

test("requires a flat, explicit local migration inventory", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "momi-migrations-flat-"))
  t.after(async () => await rm(root, { recursive: true, force: true }))
  await writeFile(join(root, "AGENTS.md"), "# Rules\n")
  await writeFile(join(root, "001_direct.sql"), "select 1;\n")
  assert.deepEqual(
    [...await loadLocalMigrations(root)],
    [["001_direct.sql", "select 1;\n"]],
  )
  await mkdir(join(root, "nested"))
  await writeFile(join(root, "nested", "001_direct.sql"), "select 2;\n")
  await assert.rejects(
    () => loadLocalMigrations(root),
    /nested: migration inventory must be flat/,
  )
})

test("rejects nested, duplicate, and executable production tree entries", () => {
  const blob = "a".repeat(40)
  const direct = `100644 blob ${blob}\tsupabase/migrations/001_direct.sql`
  assert.throws(
    () => parseProductionMigrationTree(
      `100644 blob ${blob}\tsupabase/migrations/nested/001_direct.sql\n`,
      "supabase/migrations",
    ),
    /nested\/001_direct\.sql: production migration inventory must be flat/,
  )
  assert.throws(
    () => parseProductionMigrationTree(
      `${direct}\n${direct}\n`,
      "supabase/migrations",
    ),
    /001_direct\.sql: duplicate production migration path/,
  )
  assert.throws(
    () => parseProductionMigrationTree(
      `100755 blob ${blob}\tsupabase/migrations/001_direct.sql\n`,
      "supabase/migrations",
    ),
    /production migration must be a regular, non-executable file/,
  )
})

test("loads the same explicit flat production inventory", () => {
  const agentBlob = "a".repeat(40)
  const sqlBlob = "b".repeat(40)
  const source = [
    `100644 blob ${agentBlob}\tsupabase/migrations/AGENTS.md`,
    `100644 blob ${sqlBlob}\tsupabase/migrations/001_direct.sql`,
    "",
  ].join("\n")
  assert.deepEqual(
    [...parseProductionMigrationTree(source, "supabase/migrations")],
    [["001_direct.sql", `git-blob-sha1:${sqlBlob}`]],
  )
})
