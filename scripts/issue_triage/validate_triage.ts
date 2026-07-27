import { loadTriageConfig } from "./load_triage_config.ts"
import { isPlainRecord } from "./is_plain_record.ts"
import { isSafeText, safeTextPattern } from "./safe_text.ts"
import type { IssueTriage } from "./types.ts"
import { validateRelationship } from "./validate_relationship.ts"

export { safeTextPattern }

export function validateTriage(value: unknown): IssueTriage {
  if (!isPlainRecord(value)) throw new Error("Triage output must be an object")
  const rootKeys = [
    "schema_version", "issue_number", "issue_type", "feature", "relationships",
    "safe_parallel", "confidence", "rationale", "labels",
  ]
  if (
    Object.keys(value).length !== rootKeys.length ||
    rootKeys.some((key) => !(key in value))
  ) throw new Error("Triage output has unknown or missing fields")
  if (value.schema_version !== 1) throw new Error("Unsupported schema version")
  if (
    !Number.isInteger(value.issue_number) || Number(value.issue_number) < 1 ||
    Number(value.issue_number) > 999_999_999
  ) {
    throw new Error("Invalid current issue number")
  }
  if (value.issue_type !== "bug" && value.issue_type !== "feature") {
    throw new Error("Invalid issue type")
  }
  if (!isPlainRecord(value.feature)) throw new Error("Invalid feature")
  if (
    Object.keys(value.feature).length !== 2 ||
    !("id" in value.feature) || !("title" in value.feature)
  ) throw new Error("Feature has unknown or missing fields")
  if (
    typeof value.feature.id !== "string" ||
    value.feature.id.length > 64 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+){0,5}$/.test(value.feature.id)
  ) throw new Error("Invalid feature id")
  if (
    typeof value.feature.title !== "string" ||
    value.feature.title.length > 80 ||
    !isSafeText(value.feature.title, 80)
  ) throw new Error("Invalid feature title")
  if (!Array.isArray(value.relationships) || value.relationships.length > 8) {
    throw new Error("Invalid relationship count")
  }
  const seen = new Set<number>()
  for (const relationship of value.relationships) {
    const validated = validateRelationship(relationship, Number(value.issue_number))
    if (seen.has(validated.issue_number)) {
      throw new Error("Invalid or duplicate relationship reference")
    }
    seen.add(validated.issue_number)
  }
  if (typeof value.safe_parallel !== "boolean") {
    throw new Error("Invalid safe-parallel value")
  }
  if (!["low", "medium", "high"].includes(String(value.confidence))) {
    throw new Error("Invalid confidence")
  }
  if (
    !isSafeText(value.rationale, 400)
  ) throw new Error("Invalid rationale")
  if (
    !Array.isArray(value.labels) ||
    value.labels.length !== 1 ||
    value.labels[0] !== loadTriageConfig().labels_by_issue_type[value.issue_type][0]
  ) throw new Error("Label does not match the configured issue type")
  return value as IssueTriage
}
