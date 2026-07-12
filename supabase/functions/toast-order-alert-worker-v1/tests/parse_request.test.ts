import assert from "node:assert/strict"
import test from "node:test"
import { parseWorkTrigger } from "../parse_request.ts"

const token = "4a56f5d8-bce2-4a99-8e79-dd994bf7ea65"

test("parses the strict durable work trigger", () => {
  assert.deepEqual(parseWorkTrigger({ work_id: "12", trigger_token: token }), {
    work_id: "12",
    trigger_token: token,
  })
})

test("rejects extra fields and malformed capabilities", () => {
  assert.equal(parseWorkTrigger({ work_id: "12", trigger_token: token,
    order_guid: "not-accepted" }), null)
  assert.equal(parseWorkTrigger({ work_id: "0", trigger_token: token }), null)
  assert.equal(parseWorkTrigger({ work_id: "12", trigger_token: "secret" }), null)
})
