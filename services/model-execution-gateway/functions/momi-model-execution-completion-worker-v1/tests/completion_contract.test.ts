import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parseCompletionInput } from "../src/parse_request.ts"

const workerId = "00000000-0000-4000-8000-000000000001"
const token = "00000000-0000-4000-8000-000000000002"

test("completion work accepts only the exact capability-bound input", () => {
  assert.deepEqual(parseCompletionInput({ work_id: workerId, capability_token: token }),
    { work_id: workerId, capability_token: token })
  assert.equal(parseCompletionInput({ work_id: workerId, capability_token: token,
    extra: true }), null)
  assert.equal(parseCompletionInput({ work_id: workerId, capability_token: "secret" }), null)
})

test("worker retrieves content without persisting or forwarding it", async () => {
  const processSource = await readFile(new URL("../src/process_completion.ts", import.meta.url), "utf8")
  const callbackSource = await readFile(new URL("../src/notify_caller.ts", import.meta.url), "utf8")
  assert.match(processSource, /executeProvider\(config, "GET"/)
  assert.match(processSource, /persistResult\(work\.call_id, result\)/)
  assert.match(callbackSource, /call_id: work\.call_id/)
  assert.match(callbackSource, /provider_response_id: work\.provider_response_id/)
  assert.doesNotMatch(callbackSource, /result\.body|output_text|JSON\.stringify\([^)]*body/)
})

test("webhook verifies the untouched raw body and deduplicates webhook-id", async () => {
  const source = await readFile(new URL(
    "../../momi-model-execution-webhook-v1/src/handle_request.ts", import.meta.url), "utf8")
  const rawIndex = source.indexOf("await request.text()")
  const verifyIndex = source.indexOf("client.webhooks.unwrap(rawBody, request.headers)")
  assert.ok(rawIndex >= 0 && verifyIndex > rawIndex)
  assert.match(source, /request\.headers\.get\("webhook-id"\)/)
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:rawBody|event|data)/)
})

test("migration provides webhook dedupe, lease recovery, and no body columns", async () => {
  const migration = await readFile(new URL(
    "../../../../../supabase/migrations/20260725223500_add_model_completion_trigger_adapter.sql",
    import.meta.url), "utf8")
  assert.match(migration, /webhook_id text primary key/)
  assert.match(migration, /call_id uuid not null unique/)
  assert.match(migration, /lease_expires_at/)
  assert.match(migration, /momi-model-completion-recovery-v1/)
  assert.doesNotMatch(migration, /(?:request|response|payload|body)_json\b/)
})
