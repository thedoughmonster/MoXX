import { SQL_SCHEMA_VERSION } from "./sql_artifact_constants.ts"

export function encodeQueryEnvelope(marker: string, sample: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify([{
    marker,
    schema_version: SQL_SCHEMA_VERSION,
    sample,
  }])}\n`)
}
