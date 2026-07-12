import assert from "node:assert/strict"
import test from "node:test"

import { parseRawEventId } from "../supabase/functions/toast-order-alert-eligibility-v1/parse_request.ts"

test("parses positive raw event ids without losing bigint precision", () => {
  assert.equal(parseRawEventId({ raw_event_id: "9007199254740993" }), "9007199254740993")
  assert.equal(parseRawEventId({ raw_event_id: "9223372036854775807" }), "9223372036854775807")
  assert.equal(parseRawEventId({ raw_event_id: 42 }), "42")
})
