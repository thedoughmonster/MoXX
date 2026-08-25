import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import type { TestContext } from "node:test"
import { fileURLToPath } from "node:url"

const runner = fileURLToPath(
  new URL("../scripts/run_codex_migration_guard.ts", import.meta.url),
)

export async function createCodexMigrationGuardFixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "momi-codex-migration-"))
  const migrationRoot = join(root, "supabase", "migrations")
  const protectedPath = join(migrationRoot, "001_protected.sql")
  const git = (...args: string[]) => spawnSync("git", args, {
    cwd: root, encoding: "utf8",
  })
  await mkdir(migrationRoot, { recursive: true })
  await writeFile(protectedPath, "select 1;\n")
  git("init", "-b", "main")
  git("config", "user.name", "Migration Guard Fixture")
  git("config", "user.email", "fixture@example.invalid")
  git("add", ".")
  git("commit", "-m", "Create production migration fixture")
  git("update-ref", "refs/remotes/origin/prod", "HEAD")
  t.after(async () => await rm(root, { recursive: true, force: true }))
  return {
    root,
    protectedPath,
    readProtected: () => readFile(protectedPath, "utf8"),
    removeAuthority: () => git("update-ref", "-d", "refs/remotes/origin/prod"),
    authorityExists: () => git("rev-parse", "--verify", "origin/prod").status === 0,
    invoke: (tool_name: string, tool_input: Record<string, unknown>) => {
      const result = spawnSync(process.execPath, [runner], {
        cwd: root,
        encoding: "utf8",
        input: JSON.stringify({
          session_id: "fixture-session",
          turn_id: "fixture-turn",
          cwd: root,
          hook_event_name: "PreToolUse",
          permission_mode: "default",
          model: "fixture-model",
          tool_name,
          tool_use_id: "fixture-tool-use",
          tool_input,
        }),
      })
      return {
        result,
        output: result.stdout ? JSON.parse(result.stdout) : undefined,
      }
    },
  }
}
