import assert from "node:assert/strict"
import test from "node:test"

import { completeInvocation, parseCompletionCallback } from
  "../contracts/public/momi.communications.complete_background.v1/index.ts"
import {
  ackOpenWebuiDelivery,
  claimOpenWebuiDelivery,
  retryOpenWebuiDelivery,
} from "../contracts/public/momi.communications.openwebui_delivery.v1/index.ts"

test("public communication contracts expose their existing runtimes", () => {
  assert.equal(typeof parseCompletionCallback, "function")
  assert.equal(typeof completeInvocation, "function")
  assert.equal(typeof claimOpenWebuiDelivery, "function")
  assert.equal(typeof ackOpenWebuiDelivery, "function")
  assert.equal(typeof retryOpenWebuiDelivery, "function")
})
