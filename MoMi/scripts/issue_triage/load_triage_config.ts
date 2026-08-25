import { readFileSync } from "node:fs"

import type { TriageConfig } from "../dev_loop/types.ts"

export function loadTriageConfig(
  path = ".github/codex/issue-triage.config.json",
): TriageConfig {
  const value = JSON.parse(readFileSync(path, "utf8")) as TriageConfig
  const context = value.context
  const boundedIntegers = [
    context?.issue_body_characters,
    context?.comments,
    context?.comment_characters_each,
    context?.candidate_issues,
    context?.candidate_title_characters_each,
    context?.soft_estimated_tokens,
    context?.hard_estimated_tokens,
  ]
  if (
    value.schema_version !== 1 ||
    !Array.isArray(value.labels_by_issue_type?.bug) ||
    !Array.isArray(value.labels_by_issue_type?.feature) ||
    value.labels_by_issue_type.bug.length !== 1 ||
    value.labels_by_issue_type.feature.length !== 1 ||
    !context ||
    !/^[a-z0-9:-]{1,50}$/.test(value.queue?.pending_label ?? "") ||
    boundedIntegers.some((item) =>
      !Number.isSafeInteger(item) || Number(item) < 1
    ) ||
    context.soft_estimated_tokens >= context.hard_estimated_tokens
  ) throw new Error("Invalid issue triage configuration")
  return value
}
