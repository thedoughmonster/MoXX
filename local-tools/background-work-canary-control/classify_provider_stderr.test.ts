import assert from "node:assert/strict"
import { test } from "node:test"
import { classifyProviderStderr } from "./classify_provider_stderr.ts"

const encode = (value: string) => new TextEncoder().encode(value)

test("stderr classifier recognizes only an exact closed provider code", () => {
  assert.equal(classifyProviderStderr(encode(
    "ERROR:  momi_guard_heartbeat_current_command\nDETAIL: private\n",
  )), "momi_guard_heartbeat_current_command")
  assert.equal(classifyProviderStderr(encode(
    '{"message":"momi_guard_heartbeat_expired","private":"value"}',
  )), "momi_guard_heartbeat_expired")
})

test("stderr classifier rejects unknown, ambiguous, and partial codes", () => {
  assert.equal(classifyProviderStderr(encode("ERROR: provider secret")), undefined)
  assert.equal(classifyProviderStderr(encode(
    "ERROR: momi_guard_heartbeat_expired_suffix",
  )), undefined)
  assert.equal(classifyProviderStderr(encode(
    "ERROR: momi_guard_heartbeat_expired\nmessage: momi_guard_heartbeat_readback",
  )), undefined)
})
