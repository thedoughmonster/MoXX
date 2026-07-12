import assert from "node:assert/strict"
import test from "node:test"

import { parseRawEventId } from "../supabase/functions/toast-order-alert-eligibility-v1/parse_request.ts"

test("rejects malformed or unsafe raw event ids", () => {
  assert.equal(parseRawEventId(null), null)
  assert.equal(parseRawEventId({}), null)
  assert.equal(parseRawEventId({ raw_event_id: 0 }), null)
  assert.equal(parseRawEventId({ raw_event_id: 1.5 }), null)
  assert.equal(parseRawEventId({ raw_event_id: Number.MAX_SAFE_INTEGER + 1 }), null)
  assert.equal(parseRawEventId({ raw_event_id: "01" }), null)
  assert.equal(parseRawEventId({ raw_event_id: "1.0" }), null)
  assert.equal(parseRawEventId({ raw_event_id: "9223372036854775808" }), null)
})
