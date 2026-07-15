import { fileURLToPath } from "node:url"
import { join } from "node:path"

export const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url))
export const WORKSPACE_PATH = join(REPOSITORY_ROOT, "workspace.json")
export const CONTROL_DIRECTORY = ".momi-postgres-export"
export const LOCK_FILE = ".momi-postgres-export.lock"
export const ARCHIVES_DIRECTORY = "archives"
export const DUMP_FILE = "database.pgdump"
export const SOURCE_EXPORT_FILE = "source.sql.gz"
export const WAREHOUSE_EXPORT_FILE = "warehouse.sql.gz"
export const MANUAL_DIRECTORY = "manual"
export const MANIFEST_FILE = "manifest.json"
export const RUN_ID_PATTERN = /^\d{8}T\d{9}Z-[0-9a-f]{12}$/
export const PROJECT_REF_PATTERN = /^[a-z]{20}$/
export const SCHEMA_PATTERN = /^[a-z][a-z0-9_]*$/
export const QUARTER_PATTERN = /^\d{4}-Q[1-4]$/
export const ISOLATED_TARGET_PATTERN = /^momi_restore_drill_[a-z0-9_]+$/
