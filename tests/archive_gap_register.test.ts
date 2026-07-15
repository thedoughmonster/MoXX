import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import test from "node:test"

const createPath = fileURLToPath(new URL(
  "../supabase/migrations/20260714174856_create_momi_archive_export_register.sql",
  import.meta.url,
))
const gapsPath = fileURLToPath(new URL(
  "../supabase/migrations/20260715054924_register_accepted_toast_archive_gaps.sql",
  import.meta.url,
))

test("registers every accepted Toast archive gap privately", async () => {
  const createSql = await readFile(createPath, "utf8")
  const gapsSql = await readFile(gapsPath, "utf8")
  const expectedKeys = [
    "toast-kitchen-fulfillment-204",
    "toast-stock-before-capture",
    "toast-deleted-menu-history",
    "toast-deleted-configuration-history",
    "toast-availability-before-capture",
    "toast-ordering-schedule-before-capture",
    "toast-packaging-before-capture",
    "toast-device-history-before-capture",
  ]

  for (const key of expectedKeys) {
    assert.match(`${createSql}\n${gapsSql}`, new RegExp(`'${key}'`))
  }
  assert.match(createSql, /enable row level security/g)
  assert.match(
    createSql,
    /revoke all on schema momi_archive from public, anon, authenticated/,
  )
  assert.match(
    createSql,
    /revoke all on all tables in schema momi_archive[\s\S]*public, anon, authenticated/,
  )
  assert.doesNotMatch(gapsSql, /operator_name|archive_path|sha256/)
})
