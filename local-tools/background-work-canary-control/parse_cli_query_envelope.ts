import { SQL_SCHEMA_VERSION } from "./sql_artifact_constants.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function parseCliQueryEnvelope(
  output: Uint8Array,
  expectedMarker: string,
): unknown {
  if (!(output instanceof Uint8Array) || output.byteLength < 3 || output.byteLength > 64 * 1024) {
    throw new Error("Supabase query output length is invalid")
  }
  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(output)
  } catch {
    throw new Error("Supabase query output is not valid UTF-8")
  }
  if (text[0] !== "[" || !text.endsWith("\n") || text.endsWith("\n\n") ||
    text.includes("\r") || text.includes("\0") || text.charCodeAt(0) === 0xfeff) {
    throw new Error("Supabase query output framing is invalid")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(0, -1))
  } catch {
    throw new Error("Supabase query output is malformed JSON")
  }
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error("Supabase query returned an unexpected result-set shape")
  }
  const row = validateStrictRecord(
    parsed[0], ["marker", "schema_version", "sample"], "Supabase query row",
  )
  if (row.marker !== expectedMarker || row.schema_version !== SQL_SCHEMA_VERSION) {
    throw new Error("Supabase query marker or schema version is invalid")
  }
  return row.sample
}
