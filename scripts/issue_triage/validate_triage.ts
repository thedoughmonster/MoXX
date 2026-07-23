import { loadTriageConfig } from "./load_triage_config.ts"
import { relationshipTypes, type IssueTriage } from "./types.ts"
import { isPlainRecord } from "./is_plain_record.ts"

export const safeTextPattern =
  `^[A-Za-z0-9][A-Za-z0-9 #.,;:!?()/'"&%+-]*$`
const safeText = new RegExp(safeTextPattern)

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
  if (!Number.isInteger(value.issue_number) || Number(value.issue_number) < 1) {
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
    !safeText.test(value.feature.title)
  ) throw new Error("Invalid feature title")
  if (!Array.isArray(value.relationships) || value.relationships.length > 8) {
    throw new Error("Invalid relationship count")
  }
  const seen = new Set<number>()
  let hasConstraint = false
  for (const relationship of value.relationships) {
    if (
      !isPlainRecord(relationship) ||
      Object.keys(relationship).length !== 3 ||
      !("issue_number" in relationship) ||
      !("type" in relationship) ||
      !("rationale" in relationship)
    ) throw new Error("Invalid relationship fields")
    if (
      !Number.isInteger(relationship.issue_number) ||
      Number(relationship.issue_number) < 1 ||
      relationship.issue_number === value.issue_number ||
      seen.has(Number(relationship.issue_number))
    ) throw new Error("Invalid or duplicate relationship reference")
    if (
      typeof relationship.type !== "string" ||
      !relationshipTypes.includes(relationship.type as never)
    ) throw new Error("Invalid relationship type")
    if (
      typeof relationship.rationale !== "string" ||
      relationship.rationale.length > 280 ||
      !safeText.test(relationship.rationale)
    ) throw new Error("Invalid relationship rationale")
    seen.add(Number(relationship.issue_number))
    if (relationship.type !== "independent") hasConstraint = true
  }
  if (typeof value.safe_parallel !== "boolean") {
    throw new Error("Invalid safe-parallel value")
  }
  if (value.safe_parallel && hasConstraint) {
    throw new Error("Constrained relationships cannot be safe to parallelize")
  }
  if (!["low", "medium", "high"].includes(String(value.confidence))) {
    throw new Error("Invalid confidence")
  }
  if (
    typeof value.rationale !== "string" ||
    value.rationale.length > 400 ||
    !safeText.test(value.rationale)
  ) throw new Error("Invalid rationale")
  if (
    !Array.isArray(value.labels) ||
    value.labels.length !== 1 ||
    value.labels[0] !== loadTriageConfig().labels_by_issue_type[value.issue_type][0]
  ) throw new Error("Label does not match the configured issue type")
  return value as IssueTriage
}
