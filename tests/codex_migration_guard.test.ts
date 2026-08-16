import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { createCodexMigrationGuardFixture } from
  "./create_codex_migration_guard_fixture.ts"

const hookConfiguration = fileURLToPath(
  new URL("../.codex/hooks.json", import.meta.url),
)

test("registers a synchronous pre-write hook for proven edit tools", async () => {
  const configuration = JSON.parse(await readFile(hookConfiguration, "utf8"))
  const registration = configuration.hooks.PreToolUse[0]
  assert.equal(registration.matcher, "^(apply_patch|Edit|Write)$")
  assert.match(registration.hooks[0].command, /run_codex_migration_guard\.ts/)
  assert.equal(registration.hooks[0].async, undefined)
})

test("denies an apply-patch update before a protected migration changes", async (t) => {
  const fixture = await createCodexMigrationGuardFixture(t)
  const guarded = fixture.invoke("apply_patch", {
    command: "*** Update File: supabase/migrations/001_protected.sql",
  })
  assert.equal(guarded.result.status, 0)
  assert.equal(guarded.output.hookSpecificOutput.permissionDecision, "deny")
  const denial = JSON.parse(guarded.output.hookSpecificOutput.permissionDecisionReason)
  assert.deepEqual(denial.diagnostics[0], {
    code: "PROTECTED_PRODUCTION_MIGRATION_MUTATION",
    path: "supabase/migrations/001_protected.sql",
    severity: "error",
    evidence: {
      event: "PreToolUse",
      tool_name: "apply_patch",
      authority: "origin/prod:supabase/migrations",
    },
    repair_class: "NEVER_REPAIR",
    message: "Restore or escalate; applied production migrations are immutable.",
  })
  if (guarded.output.hookSpecificOutput.permissionDecision !== "deny") {
    await writeFile(fixture.protectedPath, "select 2;\n")
  }
  assert.equal(await fixture.readProtected(), "select 1;\n")
})

test("denies Write plus apply-patch rename and delete forms", async (t) => {
  const fixture = await createCodexMigrationGuardFixture(t)
  const write = fixture.invoke("Write", { file_path: fixture.protectedPath })
  const rename = fixture.invoke("apply_patch", {
    command: [
      "*** Update File: supabase/migrations/001_protected.sql",
      "*** Move to: supabase/migrations/001_renamed.sql",
    ].join("\r\n"),
  })
  const remove = fixture.invoke("apply_patch", {
    command: "*** Delete File: supabase/migrations/001_protected.sql",
  })
  for (const attempted of [write, rename, remove]) {
    assert.equal(attempted.result.status, 0)
    assert.equal(attempted.output.hookSpecificOutput.permissionDecision, "deny")
  }
})

test("allows a migration absent from the production authority", async (t) => {
  const fixture = await createCodexMigrationGuardFixture(t)
  const path = join(fixture.root, "supabase", "migrations", "002_new.sql")
  const guarded = fixture.invoke("Write", { file_path: path })
  assert.equal(guarded.result.status, 0)
  assert.equal(guarded.result.stdout, "")
  await writeFile(path, "-- service-owner: fixture\nselect 2;\n")
  assert.match(await readFile(path, "utf8"), /select 2/)
})

test("fails closed without redefining unavailable authority", async (t) => {
  const fixture = await createCodexMigrationGuardFixture(t)
  fixture.removeAuthority()
  const guarded = fixture.invoke("apply_patch", {
    command: "*** Update File: supabase/migrations/001_protected.sql",
  })
  assert.equal(guarded.result.status, 0)
  const denial = JSON.parse(guarded.output.hookSpecificOutput.permissionDecisionReason)
  assert.equal(guarded.output.hookSpecificOutput.permissionDecision, "deny")
  assert.equal(denial.diagnostics[0].path, "supabase/migrations/001_protected.sql")
  assert.equal(denial.diagnostics[0].evidence.authority, "origin/prod:supabase/migrations")
  assert.equal(denial.diagnostics[0].repair_class, "POLICY_AUTHORIZATION")
  assert.match(denial.diagnostics[0].message, /never change or rewrite/)
  assert.equal(fixture.authorityExists(), false)
})

test("keeps unrelated edits outside the narrow migration guard", async (t) => {
  const fixture = await createCodexMigrationGuardFixture(t)
  fixture.removeAuthority()
  const guarded = fixture.invoke("Write", {
    file_path: join(fixture.root, "scripts", "example.ts"),
  })
  assert.equal(guarded.result.status, 0)
  assert.equal(guarded.result.stdout, "")
})
