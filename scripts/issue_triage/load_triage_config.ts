import { readFileSync } from "node:fs"

import type { TriageConfig } from "../dev_loop/types.ts"

export function loadTriageConfig(
  path = ".github/codex/issue-triage.config.json",
): TriageConfig {
  const value = JSON.parse(readFileSync(path, "utf8")) as TriageConfig
  if (
    value.schema_version !== 1 ||
    !Array.isArray(value.labels_by_issue_type?.bug) ||
    !Array.isArray(value.labels_by_issue_type?.feature) ||
    value.labels_by_issue_type.bug.length !== 1 ||
    value.labels_by_issue_type.feature.length !== 1
  ) throw new Error("Invalid issue triage configuration")
  return value
}
