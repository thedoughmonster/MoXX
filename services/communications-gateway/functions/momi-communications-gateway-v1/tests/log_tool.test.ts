import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { logChatResponse } from "../src/log_chat_response.ts"
import { logIdentityRefusalResponse } from "../src/log_identity_refusal_response.ts"
import { logReceipt } from "../src/log_receipt.ts"
import { logReconciliationResponse } from "../src/log_reconciliation_response.ts"
import { logReplayResponse } from "../src/log_replay_response.ts"
import { logSuccessResponse } from "../src/log_success_response.ts"
import { toolDefinitions } from "../src/tool_definitions.ts"

test("keeps logging out of model-owned tool selection", () => {
  assert.equal(toolDefinitions.some((tool) =>
    tool.function.name === "create_momi_log"), false)
})

test("validates the operations-owner receipt and renders visible success", () => {
  const receipt = logReceipt({ disposition: "stored",
    selection_id: "selection-1", shop_log_id: "log-1" })
  assert.deepEqual(receipt, { disposition: "stored",
    selection_id: "selection-1", shop_log_id: "log-1" })
  assert.equal(logReceipt({ error: "failed" }), null)
  const success = logSuccessResponse("invocation-1", receipt!)
  const response = logChatResponse(success)
  assert.equal(response.body.choices[0].message.content, "Logged to MoMi.")
  assert.equal(success.disposition, "stored")
  assert.equal(logSuccessResponse("invocation-1", {
    ...receipt!, disposition: "duplicate",
  }).disposition, "stored")
})

test("replays only a zero-provider durable log receipt", () => {
  const terminal = { id: "invocation-1", object: "momi.log",
    model: "momi-assistant", status: "completed", disposition: "duplicate",
    selection_id: "selection-1", shop_log_id: "log-1" }
  assert.deepEqual(logReplayResponse("invocation-1", {
    invocation_status: "completed", error_code: null,
    terminal_response: terminal, provider_calls: 0,
  }), { status: 200, body: terminal })
  assert.throws(() => logReplayResponse("invocation-1", {
    invocation_status: "completed", error_code: null,
    terminal_response: terminal, provider_calls: 1,
  }), /log_replay_invalid/)
})

test("short-circuits explicit logging before provider setup", async () => {
  const source = await readFile(new URL("../src/process_chat.ts", import.meta.url), "utf8")
  const selection = source.indexOf("const logSelection = resolveLogSelection(input)")
  const logging = source.indexOf("await processLog(input, logSelection)")
  const provider = source.indexOf("const tools = JSON.parse")
  assert(selection >= 0 && selection < logging && logging < provider)
})

test("returns explicit provider-free refusal and reconciliation states", () => {
  assert.deepEqual(logIdentityRefusalResponse("turn-1"), {
    status: 409, body: {
      id: "turn-1", object: "momi.log", model: "momi-assistant",
      status: "refused", error: "log_source_identity_unavailable",
    },
  })
  assert.deepEqual(logReconciliationResponse("invocation-1"), {
    status: 409, body: {
      id: "invocation-1", object: "momi.log", model: "momi-assistant",
      status: "reconciling", error: "log_reconciliation_in_progress",
    },
  })
})

test("reconciles the same receipt identity without provider effects", async () => {
  const reconcile = await readFile(
    new URL("../src/reconcile_log_invocation.ts", import.meta.url), "utf8",
  )
  const create = await readFile(
    new URL("../src/create_user_flag_log.ts", import.meta.url), "utf8",
  )
  const process = await readFile(new URL("../src/process_log.ts", import.meta.url), "utf8")
  assert.match(process,
    /invocation_status === "admitted"[\s\S]*reconcileLogInvocation/u)
  assert.match(process,
    /appendAttempted = true[\s\S]*logReconciliationResponse/u)
  assert.match(reconcile,
    /createUserFlagLog[\s\S]*captureEvidence[\s\S]*completeLogInvocation/u)
  assert.match(create, /idempotency_key \+ ":user-flag"/u)
  assert.doesNotMatch(reconcile + process,
    /from "\.\/provider|callProvider|providerRequest|fetchProvider/u)
})

test("exposes a live deployment-bound contract on the exact log route", async () => {
  const release = await readFile(
    new URL("../src/log_release_response.ts", import.meta.url), "utf8",
  )
  const handler = await readFile(new URL("../src/handle_request.ts", import.meta.url), "utf8")
  assert.match(release, /DENO_DEPLOYMENT_ID/u)
  assert.match(release, /momi\.communications\.explicit-log\/v2/u)
  assert.match(release, /8e96452d206293ccc4382812ddeb2cbc14f78768d22c4e1c736a6b50d71b5b3e/u)
  assert.match(handler, /request\.method === "HEAD" && pathname\.endsWith\("\/log"\)/u)
  assert.match(handler, /if \(!isAuthorized\(request\)\)[\s\S]*logReleaseResponse/u)
})
