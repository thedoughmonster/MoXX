import { buildProviderObservedShape } from "./build_provider_observed_shape.ts"
import { ProviderSchemaError } from "./provider_schema_error.ts"
import { SQL_SCHEMA_VERSION } from "./sql_artifact_constants.ts"

export function decodeCliQueryEnvelope(
  output: Uint8Array,
  expectedMarker: string,
  expectedSampleKeys: readonly string[] = [],
): { sample: unknown, observed: ReturnType<typeof buildProviderObservedShape> } {
  const empty = buildProviderObservedShape(undefined, expectedSampleKeys)
  if (!(output instanceof Uint8Array) || output.byteLength < 3 || output.byteLength > 64 * 1024) {
    throw new ProviderSchemaError("framing", empty)
  }
  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(output)
  } catch {
    throw new ProviderSchemaError("framing", empty)
  }
  if (!text.endsWith("\n") || text.endsWith("\n\n") ||
    text.includes("\r") || text.includes("\0") || text.charCodeAt(0) === 0xfeff) {
    throw new ProviderSchemaError("framing", empty)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(0, -1))
  } catch {
    throw new ProviderSchemaError("malformed_json", empty)
  }
  const observed = buildProviderObservedShape(parsed, expectedSampleKeys)
  if (!Array.isArray(parsed) || parsed.length !== 1 || parsed[0] === null ||
    typeof parsed[0] !== "object" || Array.isArray(parsed[0])) {
    throw new ProviderSchemaError("envelope_shape", observed)
  }
  const row = parsed[0] as Record<string, unknown>
  if (Object.keys(row).sort().join(",") !== "marker,sample,schema_version") {
    throw new ProviderSchemaError("outer_keys", observed)
  }
  if (row.marker !== expectedMarker) throw new ProviderSchemaError("marker", observed)
  if (row.schema_version !== SQL_SCHEMA_VERSION) {
    throw new ProviderSchemaError("schema_version", observed)
  }
  return { sample: row.sample, observed }
}
