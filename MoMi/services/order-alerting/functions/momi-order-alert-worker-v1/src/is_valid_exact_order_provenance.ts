export function isValidExactOrderProvenance(
  input: unknown,
  sourceSystem: string,
): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false
  }
  const value = input as Record<string, unknown>
  return value.source_system === sourceSystem &&
    value.resource_type === "order" &&
    typeof value.source_id === "string" && value.source_id.length > 0 &&
    typeof value.source_version_id === "string" &&
    value.source_version_id.length > 0 &&
    typeof value.source_content_hash === "string" &&
    /^[0-9a-f]{64}$/.test(value.source_content_hash) &&
    value.projection_contract === "canonical-resource-v2" &&
    typeof value.observed_at === "string" &&
    !Number.isNaN(Date.parse(value.observed_at))
}
