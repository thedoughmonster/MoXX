import { readFile } from "node:fs/promises"

import { DUMP_FILE, PROJECT_REF_PATTERN, RUN_ID_PATTERN, SCHEMA_PATTERN,
  SOURCE_EXPORT_FILE, WAREHOUSE_EXPORT_FILE } from "./constants.ts"
import { selectPortableSchemas } from "./select_portable_schemas.ts"
import type { DumpManifest } from "./types.ts"
import { validateFileMetadata } from "./validate_file_metadata.ts"
import { validateManualRecords } from "./validate_manual_records.ts"
import { validatePortableExport } from "./validate_portable_export.ts"

export async function readManifest(path: string): Promise<DumpManifest> {
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"))
  if (!parsed || typeof parsed !== "object") throw new Error("Archive manifest is invalid")
  const value = parsed as Partial<DumpManifest>
  const keys = [
    "archive_id", "compression", "created_at", "dump", "environment", "format",
    "manual_export_included", "manual_files", "portable_exports", "postgres_major",
    "project_ref", "schema_version", "schemas",
  ]
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys)) {
    throw new Error("Archive manifest contains missing or unknown fields")
  }
  if (value.schema_version !== 2 || value.postgres_major !== 17 ||
    value.format !== "custom" || value.compression !== "gzip:9" ||
    typeof value.archive_id !== "string" || !RUN_ID_PATTERN.test(value.archive_id) ||
    (value.environment !== "dev" && value.environment !== "prod") ||
    typeof value.project_ref !== "string" || !PROJECT_REF_PATTERN.test(value.project_ref)) {
    throw new Error("Archive manifest identity or format is invalid")
  }
  if (typeof value.created_at !== "string" ||
    new Date(value.created_at).toISOString() !== value.created_at) {
    throw new Error("Archive manifest timestamp is invalid")
  }
  if (!Array.isArray(value.schemas) || value.schemas.length === 0 ||
    new Set(value.schemas).size !== value.schemas.length ||
    value.schemas.some((schema) => typeof schema !== "string" || !SCHEMA_PATTERN.test(schema))) {
    throw new Error("Archive manifest schemas are invalid")
  }
  if (!value.dump || typeof value.dump !== "object" ||
    JSON.stringify(Object.keys(value.dump).sort()) !== JSON.stringify(["bytes", "file", "sha256"])) {
    throw new Error("Archive manifest dump metadata is invalid")
  }
  if (validateFileMetadata(value.dump, 1).file !== DUMP_FILE) {
    throw new Error("Archive manifest dump file is invalid")
  }
  if (!value.portable_exports || typeof value.portable_exports !== "object" ||
    JSON.stringify(Object.keys(value.portable_exports).sort()) !==
      JSON.stringify(["source", "warehouse"])) {
    throw new Error("Archive manifest portable exports are invalid")
  }
  const source = validatePortableExport(value.portable_exports.source, SOURCE_EXPORT_FILE)
  const warehouse = validatePortableExport(
    value.portable_exports.warehouse,
    WAREHOUSE_EXPORT_FILE,
  )
  const portableSchemas = selectPortableSchemas(value.schemas)
  if (JSON.stringify(source.schemas) !== JSON.stringify(portableSchemas.source) ||
    JSON.stringify(warehouse.schemas) !== JSON.stringify(portableSchemas.warehouse)) {
    throw new Error("Portable export schemas do not match the complete archive")
  }
  const manualFiles = validateManualRecords(value.manual_files)
  if (typeof value.manual_export_included !== "boolean" ||
    (!value.manual_export_included && manualFiles.length > 0)) {
    throw new Error("Archive manifest manual export metadata is invalid")
  }
  return value as DumpManifest
}
