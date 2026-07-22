import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { publicGatewayFailure } from "../src/public_gateway_failure.ts"

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

test("maps adjustable limit refusals without exposing database details", () => {
  assert.deepEqual(publicGatewayFailure({
    code: "22023", message: "effective rate or budget limit refused request",
  }), { status: 429, body: { error: "request_limit_reached" } })
  assert.deepEqual(publicGatewayFailure({
    code: "22023", message: "effective user limit refused request",
  }), { status: 413, body: { error: "input_limit_reached" } })
  assert.deepEqual(publicGatewayFailure(new Error("private detail")), {
    status: 503, body: { error: "gateway_failed_closed" },
  })
})
