import type { JsonObject } from "./types.ts"

export type PortableTable = JsonObject & {
  table: string
  relative_path: string
  format: "json_array_of_objects"
  encoding: "UTF-8"
  order_by: string[]
  sqlite_row_count: number
  reread_json_row_count: number
  bytes: number
  sha256: string
}

export type PortableRepairFindings = JsonObject & {
  relative_path: string
  format: "json_object_with_findings_array"
  encoding: "UTF-8"
  finding_count: number
  reread_finding_count: number
  reconciliation_passed: boolean
  bytes: number
  sha256: string
}

export type PortableManifest = JsonObject & {
  format_version: 1
  generated_at_utc: string
  source_database: JsonObject & {
    relative_path: string
    sha256: string
    verification: JsonObject & {
      integrity_check: "ok"
      foreign_key_check_rows: number
    }
  }
  table_export_count: number
  tables: PortableTable[]
  repair_findings: PortableRepairFindings
}
