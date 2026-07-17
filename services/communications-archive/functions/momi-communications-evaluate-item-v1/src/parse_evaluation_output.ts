import type { EvaluationOutput } from "./types.ts"

const decisions = new Set<string>([
  "retain", "archive", "noise", "merge_review", "needs_human_review",
])
const validations = new Set<string>([
  "supported", "uncertain", "conflicted", "not_verifiable",
])
const urgencies = new Set<string>(["none", "low", "medium", "high", "critical"])
const impacts = new Set<string>(["low", "medium", "high"])
const kinds = new Set<string>(["task", "knowledge", "incident", "alert", "other"])
const scopes = new Set<string>([
  "software_repository", "business_operations", "personal", "unknown",
])
const destinations = new Set<string>([
  "github_issue", "clickup", "none", "undetermined",
])
const topKeys = new Set<string>([
  "decision", "validation", "urgency", "impact", "confidence", "rationale",
  "flags", "merge_suggestions", "derived_records",
])
const derivedKeys = new Set<string>([
  "kind", "key", "summary", "details", "work_scope", "destination_hint",
  "confidence",
])

export function parseEvaluationOutput(value: unknown): EvaluationOutput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const output = value as Record<string, unknown>
  const keys = Object.keys(output)
  if (keys.length !== topKeys.size || keys.some((key) => !topKeys.has(key)) ||
    typeof output.decision !== "string" || !decisions.has(output.decision) ||
    typeof output.validation !== "string" || !validations.has(output.validation) ||
    typeof output.urgency !== "string" || !urgencies.has(output.urgency) ||
    typeof output.impact !== "string" || !impacts.has(output.impact) ||
    typeof output.confidence !== "number" || output.confidence < 0 ||
    output.confidence > 1 || typeof output.rationale !== "string" ||
    !Array.isArray(output.flags) || !output.flags.every((flag) => typeof flag === "string") ||
    !Array.isArray(output.merge_suggestions) ||
    !output.merge_suggestions.every((item) => typeof item === "string") ||
    !Array.isArray(output.derived_records)) return null
  for (const value of output.derived_records) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    const recordKeys = Object.keys(record)
    if (recordKeys.length !== derivedKeys.size ||
      recordKeys.some((key) => !derivedKeys.has(key)) ||
      typeof record.kind !== "string" || !kinds.has(record.kind) ||
      !(record.key === null || typeof record.key === "string") ||
      typeof record.summary !== "string" || record.summary.length === 0 ||
      !(record.details === null || typeof record.details === "string") ||
      typeof record.work_scope !== "string" || !scopes.has(record.work_scope) ||
      typeof record.destination_hint !== "string" ||
      !destinations.has(record.destination_hint) ||
      typeof record.confidence !== "number" || record.confidence < 0 ||
      record.confidence > 1) return null
  }
  return output as unknown as EvaluationOutput
}
