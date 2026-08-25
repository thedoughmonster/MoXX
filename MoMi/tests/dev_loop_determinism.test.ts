import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { buildBoundPlan } from "../scripts/dev_loop/build_bound_plan.ts"
import { buildCompactReceipt } from "../scripts/dev_loop/build_compact_receipt.ts"
import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { redactValue } from "../scripts/dev_loop/redact_value.ts"

test("same-state validation plans are byte-identical", async () => {
  const plan = await buildBoundPlan("HEAD", "HEAD")
  const firstPlan = canonicalJson(plan)
  const secondPlan = canonicalJson(await buildBoundPlan("HEAD", "HEAD"))
  assert.equal(firstPlan, secondPlan)
})

test("canonical JSON is independent of object insertion order", () => {
  assert.equal(
    canonicalJson({ z: 1, a: { y: 2, b: 3 } }),
    canonicalJson({ a: { b: 3, y: 2 }, z: 1 }),
  )
})

test("compact receipts omit success logs and bound redacted failures", () => {
  const input = {
    kind: "command" as const,
    head_sha: "a".repeat(40),
    commands: [{
      id: "pass",
      enforcement: "hard_stop" as const,
      status: 0,
      duration_ms: 7,
      stdout: "a very large successful log",
    }, {
      id: "fail",
      enforcement: "hard_stop" as const,
      status: 1,
      duration_ms: 9,
      stderr: `token=secret-value\n${"failure\n".repeat(40)}`,
    }],
  }
  const first = canonicalJson(buildCompactReceipt(input))
  const second = canonicalJson(buildCompactReceipt(input))
  assert.equal(first, second)
  const receipt = buildCompactReceipt(input)
  assert.equal(receipt.duration_ms, 16)
  assert.equal(receipt.counts.hard_failed, 1)
  assert.equal("failure_excerpt" in receipt.commands[0], false)
  assert.doesNotMatch(receipt.commands[1].failure_excerpt ?? "", /secret-value/)
  assert.ok((receipt.commands[1].failure_excerpt ?? "").split("\n").length <= 20)
})

test("committed receipt evidence summarizes byte-identically", async () => {
  const input = JSON.parse(await readFile(
    "tests/fixtures/dev_loop_receipt_input.fixture.json",
    "utf8",
  ))
  const first = canonicalJson(buildCompactReceipt(input))
  const second = canonicalJson(buildCompactReceipt(input))
  assert.equal(first, second)
  assert.doesNotMatch(first, /fixture-secret|successful raw output/)
})

test("credential-shaped receipt data is redacted recursively", () => {
  const raw = ["password=hunter2", '{"password":"two words remain-secret"}',
    '{"Authorization":"Bearer bearer value remain-bearer"}',
    '{"access_token":"json-value"}', "SUPABASE_ACCESS_TOKEN=env-value",
    "AWS_ACCESS_KEY_ID=access-value",
    "prefix ghp_abcdefghijklmnopqrstuvwxyz123456",
    "https://user:url-value@example.com?access_token=query-value"].join("\n")
  const value = redactValue({
    note: raw,
    access_token: "ghp_abcdefghijklmnopqrstuvwxyz123456",
    nested: ["sk-abcdefghijklmnop1234"],
  })
  const receipt = buildCompactReceipt({ kind: "validation", commands: [{
    id: "credentials", enforcement: "hard_stop", status: 1, duration_ms: 1,
    stderr: raw,
  }] })
  const source = canonicalJson({ value, receipt })
  assert.doesNotMatch(source,
    /hunter2|remain-secret|remain-bearer|json-value|env-value|access-value|url-value|query-value|ghp_|sk-/u)
  assert.match(source, /\[REDACTED\]/)
  assert.match(receipt.commands[0].failure_excerpt ?? "", /prefix \[REDACTED\]/u)
})
