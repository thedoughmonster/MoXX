import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../supabase/migrations/", import.meta.url)
const suffix = "_expand_toast_management_group_restaurants.sql"

test("expands archived group items within their acquisition source", async () => {
  const names = (await readdir(migrations)).filter((name) => name.endsWith(suffix))
  assert.equal(names.length, 1)
  const sql = await readFile(new URL(names[0]!, migrations), "utf8")

  assert.match(sql, /select attempt\.operation_key into archived_operation/)
  assert.match(sql, /archived_operation is distinct from 'toast\.restaurants\.group\.v1'/)
  assert.match(sql, /new\.payload <> jsonb_build_object\('guid'/)
  assert.match(sql, /jsonb_typeof\(new\.payload -> 'guid'\) <> 'string'/)
  assert.match(sql, /discovered_guid := nullif\(new\.payload ->> 'guid'/)
  assert.match(sql, /discovered_guid <> new\.source_id/)

  assert.match(sql, /job\.job_id = attempt\.job_id/)
  assert.match(sql, /requester\.source_key = job\.source_key/)
  assert.match(sql, /attempt\.restaurant_guid = new\.restaurant_guid/)
  assert.match(sql, /requester_source_key, discovered_guid, requester_enabled/)
  assert.match(sql, /on conflict \(source_key, restaurant_guid\) do nothing/)
  assert.match(sql, /perform toast_acquisition\.seed_restaurant_schedules\(/)
  assert.match(sql, /requester_enabled and discovery_active/)

  assert.match(sql, /operation_key = 'toast\.restaurants\.get\.v1'/)
  assert.match(sql, /jsonb_build_object\('restaurantGUID', discovered\.restaurant_guid/)
  assert.match(sql, /restaurant-detail-discovery:' \|\| discovered\.source_key/)
  assert.match(sql, /next_attempt_at/)
  assert.match(sql, /else 'infinity'::timestamptz end/)
  assert.match(sql, /on conflict \(idempotency_key\) do nothing/)

  assert.match(sql, /insert into toast_acquisition\.raw_processing_failures/)
  assert.match(sql, /'expand_management_group_restaurant'/)
  assert.match(sql, /exception when others then null/)
  assert.match(sql, /return new;\s*end;\s*\$\$;/)
})
