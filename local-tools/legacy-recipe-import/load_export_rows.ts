import { decodeUtf8 } from "./decode_utf8.ts"
import type { ManifestExport } from "./types.ts"

export async function loadExportRows(
  bytes: Uint8Array,
  entry: ManifestExport,
): Promise<unknown[]> {
  const parsed: unknown = JSON.parse(decodeUtf8(bytes, entry.file))
  if (entry.kind === "source_table") {
    if (!Array.isArray(parsed)) throw new Error(`${entry.file} must contain an array`)
    return parsed
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
    !Array.isArray((parsed as Record<string, unknown>).findings)) {
    throw new Error(`${entry.file} must contain one findings array`)
  }
  return (parsed as { findings: unknown[] }).findings
}
