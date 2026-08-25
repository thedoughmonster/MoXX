import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = new URL("../src/", import.meta.url)
const migrations = new URL("../../../../../supabase/migrations/", import.meta.url)

test("duplicate admission short-circuits before provider execution", async () => {
  const process = await readFile(new URL("process_chat.ts", source), "utf8")
  assert.match(process,
    /if \(admission\.disposition === "duplicate"\) return replayResponse\([\s\S]*?\)\n\s{2}try \{\n\s{4}return await executeAdmittedChat/)
})

test("first success is archived, persisted, and then returned unchanged", async () => {
  const execute = await readFile(new URL("execute_admitted_chat.ts", source), "utf8")
  const terminal = execute.indexOf("const receipt = await captureEvidence")
  const response = execute.indexOf("const response = state === \"completed\"")
  const persist = execute.indexOf("await completeInvocation", response)
  const returned = execute.indexOf("return response", persist)
  assert(terminal >= 0 && terminal < response)
  assert(response < persist && persist < returned)
  assert.match(execute, /state === "completed" \? response\.body : null/)
})

test("same key with a changed request hash remains rejected", async () => {
  const admission = await readFile(new URL(
    "20260722184318_map_gateway_provider_rounds.sql", migrations,
  ), "utf8")
  assert.match(admission,
    /if existing\.request_hash <> p_request_hash then[\s\S]*idempotency key conflicts with request/)
})
