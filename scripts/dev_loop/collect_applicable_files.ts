import { existsSync } from "node:fs"

import { workspaceRoot } from "../architecture/paths.ts"
import type { BoundPlan } from "./types.ts"

export function collectApplicableFiles(
  plan: BoundPlan,
): { rules: string[]; contracts: string[] } {
  const rules = new Set([
    "AGENTS.md",
    "docs/development-execution-handoffs.md",
    "docs/development-issue-ledger.md",
    "docs/agent-deployment-procedure.md",
    "docs/decisions/0006-github-only-deployment-authority.md",
    "docs/decisions/0008-local-cli-migration-authority.md",
  ])
  const contracts = new Set<string>()
  for (const service of plan.impact.affected_services) {
    rules.add(`services/${service}/AGENTS.md`)
    contracts.add(`services/${service}/service.json`)
  }
  for (const path of plan.changed_paths) {
    if (
      path.startsWith("docs/contracts/") || path.startsWith("schemas/") ||
      path.endsWith("/function.json") || path.endsWith("/service.json")
    ) contracts.add(path)
  }
  return {
    rules: [...rules].filter((path) => existsSync(`${workspaceRoot}/${path}`)).sort(),
    contracts: [...contracts].filter((path) =>
      existsSync(`${workspaceRoot}/${path}`)
    ).sort(),
  }
}
