export const DEV_PROJECT_REF = "xtbraqnlskmqxinjxxdn"
export const PROD_PROJECT_REF = "viodfldzuoypnpqaagag"
export const IMPORTER_VERSION = "legacy-recipe-import-v2"
export const SHA256_PATTERN = /^[0-9a-f]{64}$/
export const CONTROL_PATTERN = /[\t\r\n]/
export const MAX_BATCH_ROWS = 250
export const MAX_SQL_FILE_BYTES = 512 * 1024
export const PINNED_SUPABASE_CLI_VERSION = "2.109.1"
export const TRUSTED_LEDGER_SHA256 =
  "861f710a17c25cefbc9658c68921ac733212777481057afcc785ffb8543a54e2"
export const TRUSTED_MANIFEST_SHA256 =
  "a787b39ea0ed1d21925cf3888b23959dea3dcec168a57e69bb414af787836347"
export const TRUSTED_DATABASES = {
  "databases/toast.sqlite":
    "ae2764f13dfa06a94e8339a18f70b64931e972d9df99839d2bd4ff9500d07c0a",
  "databases/toast-api.sqlite":
    "6d883a3be624271471e677ab14a592f33b7c95c225915d2913464427b5aeece4",
} as const
export const PINNED_PACKAGE_TRUST = {
  ledgerSha256: TRUSTED_LEDGER_SHA256,
  manifestSha256: TRUSTED_MANIFEST_SHA256,
  databases: TRUSTED_DATABASES,
} as const
export const SOURCE_DATABASE_PATH = "../databases/toast.sqlite"
export const APPROVED_TABLES = [
  "recipe_documents", "recipe_versions", "recipe_yields",
  "recipe_ingredients", "recipe_dependencies", "recipe_parse_candidates",
  "purchase_items", "purchase_item_vendor_catalog",
  "purchase_item_cost_history", "map_ingredient_aliases",
  "map_recipe_ingredient_to_purchase_item", "map_unit_conversions",
  "work_purchase_unit_costs", "work_recipe_costs",
  "work_recipe_normalized_ingredients",
] as const
export const DIRECT_PG_HOST = `db.${DEV_PROJECT_REF}.supabase.co`
export const POOLER_PG_HOST = "aws-0-us-east-1.pooler.supabase.com"
export const CONFIRM_PHRASE =
  `IMPORT LEGACY RECIPES INTO DEV ${DEV_PROJECT_REF}`
