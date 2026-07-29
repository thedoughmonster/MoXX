// service-owner: trello-data-acquisition

import assert from "node:assert/strict"
import test from "node:test"
import { processSnapshot } from "../src/process_snapshot.ts"
import type { SnapshotDependencies } from "../src/types.ts"

const jobId = "11111111-1111-4111-8111-111111111111"

test("claims, acquires, and records one snapshot", async () => {
  const calls: string[] = []
  const dependencies: SnapshotDependencies = {
    getSetting: (name) => name === "TRELLO_API_KEY" ? "fixture-key" : "fixture-token",
    claim(work) {
      calls.push("claim")
      return Promise.resolve({ ...work, boardLocator: "qdzZg93X" })
    },
    acquire() {
      calls.push("acquire")
      return Promise.resolve({
        httpStatus: 200,
        headers: {},
        payload: { id: "board-1" },
        rawText: '{"id":"board-1"}',
        errorCode: null,
      })
    },
    finish() {
      calls.push("finish")
      return Promise.resolve("succeeded")
    },
  }
  const response = await processSnapshot(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, capability_token: "fixture-capability" }),
  }), dependencies)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    status: "succeeded",
    source_response: {
      http_status: 200,
      headers: {},
      payload: { id: "board-1" },
      raw_text: '{"id":"board-1"}',
      error_code: null,
    },
  })
  assert.deepEqual(calls, ["claim", "acquire", "finish"])
})

test("rejects unavailable durable work before source access", async () => {
  let acquireCalls = 0
  const dependencies: SnapshotDependencies = {
    getSetting: () => "configured",
    claim: () => Promise.resolve(null),
    acquire() {
      acquireCalls += 1
      throw new Error("must not acquire")
    },
    finish: () => Promise.reject(new Error("must not finish")),
  }
  const response = await processSnapshot(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, capability_token: "fixture-capability" }),
  }), dependencies)

  assert.equal(response.status, 409)
  assert.equal(acquireCalls, 0)
})
