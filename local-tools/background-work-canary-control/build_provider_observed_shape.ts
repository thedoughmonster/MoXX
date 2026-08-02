import type { ProviderObservedShape,
  ProviderObservedValueType } from "./provider_parse_diagnostic.ts"

export function buildProviderObservedShape(
  parsed: unknown,
  expectedSampleKeys: readonly string[],
): ProviderObservedShape {
  const topLevelType: ProviderObservedValueType = Array.isArray(parsed)
    ? "array" : parsed === null ? "null" : typeof parsed === "object"
      ? "object" : typeof parsed as ProviderObservedValueType
  const rowCount = Array.isArray(parsed) ? parsed.length : 0
  const row = Array.isArray(parsed) && parsed.length === 1 && parsed[0] !== null &&
    typeof parsed[0] === "object" && !Array.isArray(parsed[0])
    ? parsed[0] as Record<string, unknown> : undefined
  const outerExpected = ["marker", "sample", "schema_version"]
  const outerKeys = row
    ? outerExpected.filter((key) => Object.hasOwn(row, key)).join(",") || "none"
    : "none"
  const outerUnexpectedKeyCount = row
    ? Object.keys(row).filter((key) => !outerExpected.includes(key)).length : 0
  const sample = row?.sample !== null && typeof row?.sample === "object" &&
    !Array.isArray(row.sample) ? row.sample as Record<string, unknown> : undefined
  const presentSampleKeys = sample
    ? expectedSampleKeys.filter((key) => Object.hasOwn(sample, key)) : []
  const sampleKeys = presentSampleKeys.join(",") || "none"
  const sampleUnexpectedKeyCount = sample
    ? Object.keys(sample).filter((key) => !expectedSampleKeys.includes(key)).length : 0
  const sampleValueTypes = sample ? presentSampleKeys.map((key) => {
    const value = sample[key]
    const type = Array.isArray(value) ? "array" : value === null ? "null" : typeof value
    return `${key}:${type}`
  }).join(",") || "none" : "none"
  return Object.freeze({
    topLevelType, rowCount, outerKeys, outerUnexpectedKeyCount,
    sampleKeys, sampleUnexpectedKeyCount, sampleValueTypes,
  })
}
