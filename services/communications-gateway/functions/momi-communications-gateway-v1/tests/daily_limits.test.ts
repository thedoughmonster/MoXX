import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = new URL(
  "../../../../../supabase/migrations/20260721184647_add_gateway_daily_request_limits.sql",
  import.meta.url,
)

test("enforces an adjustable per-user UTC daily request ceiling", async () => {
  const sql = await readFile(migration, "utf8")
  assert.match(sql, /requests_per_day integer not null default 50/u)
  assert.match(sql, /daily_count >= limits\.requests_per_day/u)
  assert.match(sql, /started_at >= date_trunc\('day', now\(\)\)/u)
  assert.match(sql, /'requests_per_day', p_requests_per_day/u)
})
