import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { extractCodexEditPaths, type CodexEditEvent } from
  "./extract_codex_edit_paths.ts"
import { loadProductionMigrations } from
  "./migrations/load_production_migrations.ts"

export function runCodexMigrationGuard(
  source: string,
  suppliedRepositoryRoot?: string,
): string | undefined {
  const event = JSON.parse(source) as CodexEditEvent
  let repositoryRoot = suppliedRepositoryRoot
  if (!repositoryRoot) {
    const rootResult = spawnSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    })
    if (rootResult.status !== 0 || !rootResult.stdout.trim()) {
      throw new Error("Unable to resolve the repository root")
    }
    repositoryRoot = rootResult.stdout.trim()
  }
  const monorepoMigrationRoot = "MoMi/supabase/migrations"
  const migrationRoot = existsSync(`${repositoryRoot}/${monorepoMigrationRoot}`)
    ? monorepoMigrationRoot
    : "supabase/migrations"
  const authority = `origin/prod:${migrationRoot}`
  const paths = extractCodexEditPaths(event, repositoryRoot)
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
    return JSON.stringify({
      systemMessage: "Trusted production migration authority is unavailable.",
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: JSON.stringify({ diagnostics }),
      },
    })
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
  return JSON.stringify({
    systemMessage: "A trusted production migration edit was denied.",
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: JSON.stringify({ diagnostics }),
    },
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let source = ""
  process.stdin.setEncoding("utf8")
  for await (const chunk of process.stdin) source += chunk
  const output = runCodexMigrationGuard(source)
  if (output) process.stdout.write(output)
}
