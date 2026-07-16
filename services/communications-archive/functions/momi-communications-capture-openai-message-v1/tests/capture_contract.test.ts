import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { isAuthorizedRequest } from "../src/authorize_request.ts"
import { parseRequest } from "../src/parse_request.ts"

const functionDir = new URL("../", import.meta.url)
const supabaseConfig = new URL(
  "../../../../../supabase/config.toml",
  import.meta.url,
)

test("accepts one complete OpenAI message identity payload", () => {
  const parsed = parseRequest({
    source_account_key: "openai:workspace-a",
    source_user_key: "user:lydia",
    source_conversation_key: "chatcmpl-thread-1",
    source_message_key: "msg-1",
    sender_role: "user",
    occurred_at: "2026-07-16T10:00:00.000Z",
    idempotency_key: "openai/workspace-a/thread-1/msg-1",
    payload: { content: "Please summarize this." },
    source_metadata: { surface: "chatgpt" },
  })

  assert.ok(parsed)
  assert.equal(parsed.source_account_key, "openai:workspace-a")
})

test("rejects widened capture payloads", () => {
  const parsed = parseRequest({
    source_account_key: "openai:workspace-a",
    source_user_key: "user:lydia",
    source_conversation_key: "thread-1",
    source_message_key: "msg-1",
    sender_role: "user",
    occurred_at: "2026-07-16T10:00:00.000Z",
    idempotency_key: "openai/workspace-a/thread-1/msg-1",
    payload: { content: "hello" },
    sql: "drop table momi_communications.archive_items",
  })

  assert.equal(parsed, null)
})

test("rejects malformed dates and optional field types", () => {
  const base = {
    source_account_key: "openai:workspace-a",
    source_user_key: "user:lydia",
    source_conversation_key: "thread-1",
    source_message_key: "msg-1",
    sender_role: "user",
    occurred_at: "2026-07-16T10:00:00.000Z",
    idempotency_key: "openai/workspace-a/thread-1/msg-1",
    payload: { content: "hello" },
  }

  assert.equal(parseRequest({ ...base, occurred_at: "not-a-date" }), null)
  assert.equal(parseRequest({ ...base, captured_at: null }), null)
  assert.equal(parseRequest({ ...base, raw_text: 42 }), null)
})

test("function wrapper calls only the structured capture RPC", async () => {
  const source = await readFile(new URL(
    "src/capture_openai_message.ts",
    functionDir,
  ), "utf8")

  assert.match(source, /momi_communications\.capture_openai_message_v1/)
  assert.match(source, /evaluation_job_id::text/)
  assert.match(source, /getDatabase\(\)/)
  assert.doesNotMatch(source, /insert into momi_communications\.archive_items/)
  assert.doesNotMatch(source, /fetch\(/)
})

test("requires a gateway-verified user or service role", async () => {
  const authenticated = btoa(JSON.stringify({ role: "authenticated" }))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
  const anonymous = btoa(JSON.stringify({ role: "anon" }))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")

  assert.equal(isAuthorizedRequest(new Request("https://momi.test", {
    headers: { Authorization: `Bearer x.${authenticated}.x` },
  })), true)
  assert.equal(isAuthorizedRequest(new Request("https://momi.test", {
    headers: { Authorization: `Bearer x.${anonymous}.x` },
  })), false)
  assert.equal(isAuthorizedRequest(new Request("https://momi.test")), false)

  const config = await readFile(supabaseConfig, "utf8")
  assert.match(config, /\[functions\.momi-communications-capture-openai-message-v1\][\s\S]*verify_jwt = true/)
})
