import assert from "node:assert/strict"
import test from "node:test"
import { readPublishableKey } from "../src/read_publishable_key.ts"

test("reads only the named default publishable key", () => {
  assert.equal(readPublishableKey('{"default":"sb_publishable_test"}'),
    "sb_publishable_test")
  assert.equal(readPublishableKey('{"other":"sb_publishable_test"}'), null)
  assert.equal(readPublishableKey("not-json"), null)
})
