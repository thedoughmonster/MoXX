import assert from "node:assert/strict"
import test from "node:test"

import { isSlackSuccess } from "../src/is_slack_success.ts"
import { sendSlackMessage } from "../src/send_slack_message.ts"
import { summarizeSlackResponse } from "../src/summarize_slack_response.ts"

test("posts the prepared payload with the fixed Slack contract", async () => {
  const payload = {
    channel: "C123",
    text: "Prepared alert",
    blocks: [{ type: "section", text: { type: "mrkdwn", text: "Alert" } }],
  }
  let capturedUrl = ""
  let capturedInit: RequestInit | undefined
  const fetchImpl: typeof fetch = (input, init) => {
    capturedUrl = String(input)
    capturedInit = init
    return Promise.resolve(
      Response.json({ ok: true, channel: "C123", ts: "123.456" }, {
        headers: {
          "x-slack-req-id": "request-1",
          "set-cookie": "secret=ignored",
        },
      }),
    )
  }

  const result = await sendSlackMessage(payload, "bot-token", fetchImpl)
  const headers = new Headers(capturedInit?.headers)

  assert.equal(capturedUrl, "https://slack.com/api/chat.postMessage")
  assert.equal(capturedInit?.method, "POST")
  assert.equal(headers.get("Authorization"), "Bearer bot-token")
  assert.equal(headers.get("Content-Type"), "application/json")
  assert.equal(String(capturedInit?.body), JSON.stringify(payload))
  assert.equal(capturedInit?.signal instanceof AbortSignal, true)
  assert.equal(result.response_headers["x-slack-req-id"], "request-1")
  assert.equal("set-cookie" in result.response_headers, false)
  assert.equal(JSON.stringify(result).includes("bot-token"), false)
  assert.equal(isSlackSuccess(result), true)
  const summary = summarizeSlackResponse(result)
  assert.equal(summary.channel, "C123")
  assert.equal(summary.ts, "123.456")
  assert.equal(isSlackSuccess({ ...result, status: 201 }), false)
  assert.equal(isSlackSuccess({ ...result, is_json: false }), false)

  const rejected = { ...result, body: { ok: false, error: "channel_not_found" } }
  assert.equal(isSlackSuccess(rejected), false)
  assert.equal(summarizeSlackResponse(rejected).slack_error, "channel_not_found")
})
