import { SCHEMA_PATTERN } from "./constants.ts"
import type { PortableExport } from "./types.ts"
import { validateFileMetadata } from "./validate_file_metadata.ts"

export function validatePortableExport(value: unknown, expectedFile: string): PortableExport {
  if (!value || typeof value !== "object" ||
    JSON.stringify(Object.keys(value).sort()) !==
      JSON.stringify(["bytes", "compression", "file", "format", "schemas", "sha256"])) {
    throw new Error("Portable export metadata contains missing or unknown fields")
  }
  const metadata = validateFileMetadata(value, 1)
  const portable = value as Partial<PortableExport>
  if (metadata.file !== expectedFile || portable.format !== "plain-sql" ||
    portable.compression !== "gzip:9" || !Array.isArray(portable.schemas) ||
    portable.schemas.length === 0 || new Set(portable.schemas).size !== portable.schemas.length ||
    portable.schemas.some((schema) => typeof schema !== "string" || !SCHEMA_PATTERN.test(schema))) {
    throw new Error("Portable export format or schemas are invalid")
  }
  return portable as PortableExport
}
