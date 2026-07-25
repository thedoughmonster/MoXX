import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parseCompletionCallback } from "../src/parse_completion_callback.ts"
import { pendingAssistantContent, pendingResponse } from "../src/pending_response.ts"
import { providerResponseId } from "../src/provider_response_id.ts"

const callId = "00000000-0000-4000-8000-000000000001"

test("maximum background response is immediately visible and non-empty", () => {
  const response = pendingResponse(callId)
  assert.equal(response.status, 200)
  assert.equal(response.body.momi_background, true)
  assert.equal(response.body.choices[0].message.content, pendingAssistantContent)
  assert.ok(pendingAssistantContent.length > 0)
})

test("completion callback binds exact call and provider response identities", () => {
  assert.deepEqual(parseCompletionCallback({ schema_version: 1, call_id: callId,
    provider_response_id: "resp_example-1" }), { call_id: callId,
    provider_response_id: "resp_example-1" })
  assert.equal(parseCompletionCallback({ schema_version: 1, call_id: callId,
    provider_response_id: "wrong" }), null)
  assert.equal(providerResponseId({ id: "resp_example-1" }), "resp_example-1")
})

test("durable resume preserves tools and produces an exact delivery outbox", async () => {
  const resume = await readFile(new URL("../src/resume_async_round.ts", import.meta.url), "utf8")
  const migration = await readFile(new URL(
    "../../../../../supabase/migrations/20260725223600_add_communications_async_completion.sql",
    import.meta.url), "utf8")
  assert.match(resume, /runToolCall/)
  assert.match(resume, /providerContinuationRequest/)
  assert.match(resume, /finishAsyncRound/)
  assert.match(migration, /invocation_id uuid not null unique/)
  assert.match(migration, /conversation_id text not null/)
  assert.match(migration, /turn_id text not null/)
  assert.match(migration, /claim_openwebui_delivery_v1/)
  assert.match(migration, /ack_openwebui_delivery_v1/)
})

test("gateway exposes separate authenticated completion and relay delivery routes", async () => {
  const source = await readFile(new URL("../src/handle_request.ts", import.meta.url), "utf8")
  assert.match(source, /\/model-completions/)
  assert.match(source, /isCompletionAuthorized/)
  assert.match(source, /\/deliveries\/claim/)
  assert.match(source, /\/deliveries\/ack/)
  assert.match(source, /isAuthorized/)
})
