import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  terminalLimitationCodes,
  terminalLimitationResponse,
} from "../src/terminal_limitation_response.ts"

const source = new URL("../src/", import.meta.url)

test("returns safe non-empty ChatCompletion limitations for Open Relay", () => {
  for (const code of terminalLimitationCodes) {
    const response = terminalLimitationResponse("invocation", code)
    const content = response.body.choices[0].message.content
    assert.equal(response.status, 200)
    assert.equal(response.body.object, "chat.completion")
    assert.equal(response.body.model, "momi-assistant")
    assert.equal(response.body.choices[0].finish_reason, "stop")
    assert.equal(typeof content, "string")
    assert(content.length > 20)
    assert.match(content, /No additional provider attempt|not retried/u)
    assert.doesNotMatch(content, /sql|relation|uuid|credential|provider model/iu)
  }
})

test("persists limitations before returning and preserves exact replay", async () => {
  const completion = await readFile(
    new URL("complete_visible_limitation.ts", source),
    "utf8",
  )
  const execution = await readFile(
    new URL("execute_admitted_chat.ts", source),
    "utf8",
  )
  const providerCompletion = await readFile(
    new URL("complete_provider_limitation.ts", source),
    "utf8",
  )
  const process = await readFile(new URL("process_chat.ts", source), "utf8")
  assert.match(completion,
    /captureEvidence[\s\S]*"visible_terminal_limitation"[\s\S]*completeInvocation/)
  assert.match(completion,
    /"completed"[\s\S]*code[\s\S]*response\.body/)
  assert.match(execution,
    /terminalLimitationCodes\.has\(providerError\)[\s\S]*completeProviderLimitation/)
  assert.match(providerCompletion,
    /completeInvocation[\s\S]*"completed"[\s\S]*code[\s\S]*response\.body/)
  assert.match(process,
    /provider_round_not_authorized[\s\S]*completeVisibleLimitation/)
})

test("rejects unknown limitation codes", () => {
  assert.throws(() => terminalLimitationResponse("invocation", "unknown"))
})
