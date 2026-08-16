import { spawnSync } from "node:child_process"

import { extractCodexEditPaths, type CodexEditEvent } from
  "./extract_codex_edit_paths.ts"
import { loadProductionMigrations } from
  "./migrations/load_production_migrations.ts"

const migrationRoot = "supabase/migrations"
const authority = "origin/prod:supabase/migrations"

async function runCodexMigrationGuard() {
  let source = ""
  process.stdin.setEncoding("utf8")
  for await (const chunk of process.stdin) source += chunk
  const event = JSON.parse(source) as CodexEditEvent
  const rootResult = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  })
  if (rootResult.status !== 0 || !rootResult.stdout.trim()) {
    throw new Error("Unable to resolve the repository root")
  }
  const paths = extractCodexEditPaths(event, rootResult.stdout.trim())
  const migrationPaths = paths.filter((path) =>
    path.startsWith(`${migrationRoot}/`) && path.endsWith(".sql")
  )
  if (migrationPaths.length === 0) return

  let protectedNames: Set<string>
  try {
    protectedNames = new Set(loadProductionMigrations(migrationRoot).keys())
  } catch {
    const diagnostics = migrationPaths.map((path) => ({
      code: "PROTECTED_MIGRATION_AUTHORITY_UNAVAILABLE",
      path,
      severity: "error",
      evidence: { event: "PreToolUse", tool_name: event.tool_name, authority },
      repair_class: "POLICY_AUTHORIZATION",
      message: "Escalate; never change or rewrite the trusted production authority.",
    }))
    process.stdout.write(JSON.stringify({
      systemMessage: "Trusted production migration authority is unavailable.",
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: JSON.stringify({ diagnostics }),
      },
    }))
    return
  }

  const protectedPaths = migrationPaths.filter((path) =>
    protectedNames.has(path.slice(migrationRoot.length + 1))
  )
  if (protectedPaths.length === 0) return
  const diagnostics = protectedPaths.map((path) => ({
    code: "PROTECTED_PRODUCTION_MIGRATION_MUTATION",
    path,
    severity: "error",
    evidence: { event: "PreToolUse", tool_name: event.tool_name, authority },
    repair_class: "NEVER_REPAIR",
    message: "Restore or escalate; applied production migrations are immutable.",
  }))
  process.stdout.write(JSON.stringify({
    systemMessage: "A trusted production migration edit was denied.",
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: JSON.stringify({ diagnostics }),
    },
  }))
}

await runCodexMigrationGuard()
