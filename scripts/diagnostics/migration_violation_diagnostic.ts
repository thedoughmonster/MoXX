import { posix } from "node:path"

import { classifyMigrationViolation } from
  "./classify_migration_violation.ts"
import type { MigrationDiagnosticPhase } from
  "./classify_migration_violation.ts"
import type { RepositoryDiagnosticV1 } from "./types.ts"

export function migrationViolationDiagnostic(
  violation: string,
  migrationPath: string,
  phase: MigrationDiagnosticPhase = "violation",
): RepositoryDiagnosticV1 {
  const match = violation.match(/^([^:\n]+)(?::(\d+))?: (.+)$/u)
  const candidate = match?.[1]
  const rawDetail = match?.[3] ?? ""
  const basename = candidate && (/^[^/\s:]+\.sql$/u.test(candidate) ||
    (/migration inventory|migration must/u.test(rawDetail) &&
      /^[^/\s:]+$/u.test(candidate)))
  const fullPath = candidate?.startsWith(`${migrationPath}/`) &&
    /^[^/\s:]+$/u.test(candidate.slice(migrationPath.length + 1))
  const file = basename || fullPath ? candidate : undefined
  const detail = file ? rawDetail : violation
  const rule = classifyMigrationViolation(detail)
  const servicePath = violation.match(
    /\bservices\/[a-z][a-z0-9-]+\/service\.json\b/u,
  )?.[0]
  const path = rule.rule_id === "MIGRATION_CORRECTION_LEDGER"
    ? "docs/verification/development-migration-corrections.json"
    : file
      ? file.startsWith(`${migrationPath}/`) ? file : posix.join(migrationPath, file)
      : rule.rule_id === "MIGRATION_TRUSTED_AUTHORITY_SNAPSHOT"
        ? servicePath
        : undefined
  const line = file && match?.[2] ? Number(match[2]) :
    /physical line 1/u.test(detail) ? 1 : undefined
  return {
    schema_version: 1,
    rule_id: rule.rule_id,
    enforcement: "hard_stop",
    ...(path ? { location: line ? { path, line } : { path } } : {}),
    violated_rule: rule.violated_rule,
    rationale: `Reported condition: ${detail}`,
    expected: rule.expected,
    repair: { kind: "none" },
    validation_command: "pnpm migration:check",
    fingerprint: {
      group: { rule_id: rule.rule_id },
      instance: { path: path ?? "(migration check)", phase },
    },
  }
}
