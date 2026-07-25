import type { ImpactClass } from "./types.ts"

export function classifyPath(path: string): ImpactClass {
  if (path.startsWith("supabase/migrations/")) return "migration"
  if (
    path === "supabase/config.toml" ||
    /^(?:services\/[^/]+\/service\.json|services\/[^/]+\/functions\/[^/]+\/function\.json)$/
      .test(path)
  ) return "manifest"
  if (path.startsWith("services/") || path.startsWith("supabase/functions/")) {
    return "runtime"
  }
  if (
    path === "workspace.json" || path.startsWith("schemas/") ||
    path.startsWith("retirements/") || path.startsWith("scripts/architecture/") ||
    path.startsWith("scripts/constitution/") ||
    path.startsWith("scripts/migrations/")
  ) return "architecture"
  if (
    path === ".github/workflows/issue-ledger.yml" ||
    path === ".github/workflows/issue-triage.yml" ||
    path.startsWith(".github/codex/") ||
    path.startsWith("scripts/issue_") ||
    path.startsWith("tests/issue_")
  ) return "issue_automation"
  if (path.startsWith(".github/workflows/") || path.startsWith(".github/actions/")) {
    return "workflow"
  }
  if (
    path === "AGENTS.md" || path === "README.md" ||
    path.endsWith("/AGENTS.md") || path.endsWith("/README.md") ||
    path.startsWith("docs/")
  ) return "docs"
  if (
    path.startsWith("scripts/") || path.startsWith("tests/") ||
    path === "package.json" || path === "pnpm-lock.yaml" ||
    path === ".node-version" || path === ".gitignore"
  ) return "repository_tooling"
  return "unknown"
}
