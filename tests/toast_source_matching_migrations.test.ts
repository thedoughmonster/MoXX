import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../supabase/migrations/", import.meta.url)

test("configures complete and non-overlapping Toast source matching", async () => {
  const [operatorSql, rawClaimSql, hydratedClaimSql] = await Promise.all([
    readFile(
      new URL("20260712182744_add_toast_source_match_operators.sql", migrations),
      "utf8",
    ),
    readFile(
      new URL("20260712182751_update_raw_alert_claim_source_matching.sql", migrations),
      "utf8",
    ),
    readFile(
      new URL("20260712182801_update_hydrated_alert_claim_source_matching.sql", migrations),
      "utf8",
    ),
  ])

  assert.match(operatorSql, /match_operator in \('equals', 'not_equals'\)/)
  assert.match(operatorSql, /when 'equals' then/)
  assert.match(operatorSql, /when 'not_equals' then/)
  assert.match(operatorSql, /input_payload #>> input_path is not null/)
  assert.match(operatorSql, /input_payload #> input_path <> input_expected_value/)

  for (const claimSql of [rawClaimSql, hydratedClaimSql]) {
    assert.match(claimSql, /toast_alerting\.matches_source_value\(/)
    assert.match(claimSql, /source\.match_operator/)
  }
})
