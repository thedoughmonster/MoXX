import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { analysisDatabaseError } from "../src/analysis_database_error.ts"
import { assistantInstructions } from "../src/assistant_instructions.ts"
import { failedProviderResponse } from "../src/failed_provider_response.ts"
import type { AssistantContext } from "../src/types.ts"

const fixtureUrl = new URL("./fixtures/correctness_burndown.json", import.meta.url)
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"))
const context: AssistantContext = {
  context_version: "fixture",
  assistant_name: "Assistant",
  organization_name: "Mapped Org",
  organization_aliases: ["Mapped Alias"],
  context_summary: "Mapped context.",
  primary_scope_key: "primary",
  primary_location_name: "Mapped Shop",
  primary_timezone: "America/New_York",
  current_business_date: "2026-07-23",
  analysis_catalog: [
    { relation_name: "order_items_v1", description: "Mapped items.",
      columns: ["item_name:text"] },
    { relation_name: "menu_items_v1", description: "Mapped menu.",
      columns: ["item_name:text", "display_name:text"] },
    { relation_name: "payments_v1", description: "Mapped payments.",
      columns: ["status:text"] },
    { relation_name: "orders_v1", description: "Mapped orders.",
      columns: ["submitted_at:timestamptz", "opened_at:timestamptz",
        "closed_at:timestamptz"] },
  ],
}

test("historical correctness fixture is represented by mapped policies", () => {
  const instructions = assistantInstructions(context)
  assert.equal(fixture.entity_reconciliation.earlier_sourced_count, 12)
  assert.equal(fixture.payment_status.discovered_value, "CAPTURED")
  assert.deepEqual(fixture.timestamp_coverage.expected_preference,
    ["submitted_at", "opened_at", "closed_at"])
  assert.match(instructions, /mapped aliases/u)
  assert.match(instructions, /distinct.*status/u)
  assert.match(instructions, /Do not retract/u)
  assert.match(instructions, /submitted_at.*opened_at.*closed_at/u)
})

test("database failures collapse only to safe actionable categories", () => {
  const cases: Array<[unknown, string]> = [
    [{ code: "42703" }, "analysis_query_schema_mismatch"],
    [{ code: "57014" }, "analysis_query_timeout"],
    [{ message: "analysis_result_too_large" }, "analysis_result_too_large"],
    [{ code: "42501" }, "analysis_query_permission_denied"],
    [{ code: "22007" }, "analysis_query_data_error"],
    [new Error("private internal detail"), "analysis_query_database_error"],
  ]
  for (const [error, expected] of cases) {
    assert.equal(analysisDatabaseError(error), expected)
    assert(fixture.safe_errors.includes(expected))
  }
})

test("Maximum failure is non-empty and explicitly never retried", () => {
  const response = failedProviderResponse("invocation", "failed",
    fixture.maximum.visible_deadline_error)
  assert.equal(response.status, 504)
  assert.equal(response.body.error, "maximum_analysis_deadline_exceeded")
  assert.match(response.body.message, /not retried/u)
  assert.equal(fixture.maximum.automatic_paid_retries, 0)
})
