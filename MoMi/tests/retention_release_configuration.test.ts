import assert from "node:assert/strict"
import test from "node:test"
import { assertRetentionConfiguration } from "../scripts/release/retention/assert_configuration.ts"

test("requires the metrics secret name without inspecting or returning any secret value", () => {
  assert.doesNotThrow(() => assertRetentionConfiguration(JSON.stringify([
    {name:"MOMI_CRON_HISTORY_METRICS_SECRET_KEY",digest:"synthetic-metadata"},
  ])))
  for (const value of [[], [{name:"UNRELATED"}], [null], {}, "invalid"]) {
    assert.throws(() => assertRetentionConfiguration(JSON.stringify(value)))
  }
})
