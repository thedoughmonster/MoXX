export const PROVIDER_PARSE_SUBREASONS = [
  "command_hash", "context", "envelope_shape", "expiry", "field_type",
  "framing", "identity", "malformed_json", "marker", "outer_keys",
  "sample_keys", "sample_shape", "schema_version",
] as const

export type ProviderParseSubreason = typeof PROVIDER_PARSE_SUBREASONS[number]

export type ProviderObservedValueType =
  | "array" | "boolean" | "null" | "number" | "object" | "string" | "undefined"

export type ProviderObservedShape = Readonly<{
  topLevelType: ProviderObservedValueType
  rowCount: number
  outerKeys: string
  outerUnexpectedKeyCount: number
  sampleKeys: string
  sampleUnexpectedKeyCount: number
  sampleValueTypes: string
}>

export type ProviderParseDiagnostic = ProviderObservedShape & Readonly<{
  subreason: ProviderParseSubreason
}>

export const EMPTY_PROVIDER_OBSERVED_SHAPE: ProviderObservedShape = Object.freeze({
  topLevelType: "undefined",
  rowCount: 0,
  outerKeys: "none",
  outerUnexpectedKeyCount: 0,
  sampleKeys: "none",
  sampleUnexpectedKeyCount: 0,
  sampleValueTypes: "none",
})
