import {
  APPROVED_TABLES, PINNED_PACKAGE_TRUST, SHA256_PATTERN, SOURCE_DATABASE_PATH,
} from "./constants.ts"
import type {
  PortableManifest, PortableRepairFindings, PortableTable,
} from "./manifest_types.ts"
import type { PackageTrust } from "./types.ts"

export function validateManifest(
  value: unknown,
  trust: PackageTrust = PINNED_PACKAGE_TRUST,
): PortableManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("portable/manifest.json must contain one object")
  }
  const manifest = value as Record<string, unknown>
  if (manifest.format_version !== 1 ||
    typeof manifest.generated_at_utc !== "string" ||
    !Number.isFinite(Date.parse(manifest.generated_at_utc))) {
    throw new Error("Manifest must be portable recipe format_version 1")
  }
  const source = manifest.source_database as Record<string, unknown> | undefined
  const verification = source?.verification as Record<string, unknown> | undefined
  if (!source || source.relative_path !== SOURCE_DATABASE_PATH ||
    source.sha256 !== trust.databases["databases/toast.sqlite"] ||
    verification?.integrity_check !== "ok" ||
    verification.foreign_key_check_rows !== 0) {
    throw new Error("Manifest source database verification is invalid")
  }
  if (!Array.isArray(manifest.tables) ||
    manifest.tables.length !== APPROVED_TABLES.length ||
    manifest.table_export_count !== APPROVED_TABLES.length) {
    throw new Error("Manifest table export count is invalid")
  }
  const files = new Set<string>()
  const tables = new Set<string>()
  for (let index = 0; index < manifest.tables.length; index += 1) {
    const raw = manifest.tables[index]
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Every table export must be an object")
    }
    const entry = raw as Record<string, unknown>
    const approvedTable = APPROVED_TABLES[index]
    const approvedPath = `portable/tables/${approvedTable}.json`
    if (entry.table !== approvedTable || entry.relative_path !== approvedPath ||
      tables.has(String(entry.table))) {
      throw new Error("Manifest datasets do not match the approved recipe allowlist")
    }
    tables.add(approvedTable)
    if (files.has(approvedPath)) throw new Error("Duplicate table export path")
    files.add(approvedPath)
    if (entry.format !== "json_array_of_objects" || entry.encoding !== "UTF-8" ||
      !Array.isArray(entry.order_by) || entry.order_by.some((key) =>
        typeof key !== "string" || key.length === 0)) {
      throw new Error(`Invalid table format: ${entry.table}`)
    }
    if (!Number.isSafeInteger(entry.bytes) || Number(entry.bytes) < 0 ||
      !Number.isSafeInteger(entry.sqlite_row_count) || Number(entry.sqlite_row_count) < 0 ||
      entry.sqlite_row_count !== entry.reread_json_row_count) {
      throw new Error(`Invalid table counts: ${entry.table}`)
    }
    if (typeof entry.sha256 !== "string" || !SHA256_PATTERN.test(entry.sha256)) {
      throw new Error(`Invalid table SHA-256: ${entry.table}`)
    }
  }
  const repair = manifest.repair_findings as Record<string, unknown> | undefined
  if (!repair || typeof repair.relative_path !== "string" ||
    repair.relative_path !== "repair_findings.json" ||
    repair.format !== "json_object_with_findings_array" || repair.encoding !== "UTF-8" ||
    !Number.isSafeInteger(repair.bytes) || Number(repair.bytes) < 0 ||
    !Number.isSafeInteger(repair.finding_count) || Number(repair.finding_count) < 0 ||
    repair.finding_count !== repair.reread_finding_count ||
    repair.reconciliation_passed !== true || typeof repair.sha256 !== "string" ||
    !SHA256_PATTERN.test(repair.sha256)) {
    throw new Error("Manifest repair findings metadata is invalid")
  }
  return manifest as unknown as PortableManifest & {
    tables: PortableTable[]
    repair_findings: PortableRepairFindings
  }
}
