import assert from "node:assert/strict"
import test from "node:test"

import { providerRequest } from "../src/provider_request.ts"
import type { Admission, Message } from "../src/types.ts"

test("uses the supported non-reasoning Chat Completions tool contract", () => {
  const admission = ({ provider_model: "provider-model",
    maximum_output_tokens: 4000 } as Admission)
  const messages: Message[] = [{ role: "user", content: "question" }]
  const request = providerRequest(messages,
    "c03fbd6e-65b7-4b23-8e65-2e5a8ec00123", admission,
    [{ type: "function", function: { name: "read", parameters: {} } }])
  assert.equal(request.reasoning_effort, "none")
  assert.equal(request.tool_choice, "auto")
  assert.equal(request.parallel_tool_calls, false)
  assert.equal(request.store, false)
  assert.equal(request.safety_identifier, "c03fbd6e-65b7-4b23-8e65-2e5a8ec00123")
})
