import assert from "node:assert/strict"
import type { TestContext } from "node:test"
import { handleRequestWithReader } from "../src/handle_request_with_reader.ts"
import { revalidate } from "../src/revalidate.ts"
import type { Input, Selection } from "../src/types.ts"

export async function assertRollingExpiryRegressions(
  t: TestContext, input: Input, data: Record<string, unknown>,
) {
  let now = Date.parse("2026-07-31T12:00:00Z")
  t.mock.timers.enable({ apis: ["Date"], now })
  const fresh = { ...data, expires_at: new Date(now + 60_000).toISOString() }
  let selection = revalidate(input, fresh).context as Selection
  const original = selection
  const read = async (saved: Selection, expiresAt?: string) => {
    now += 1000
    t.mock.timers.setTime(now)
    const response = await handleRequestWithReader(new Request(
      "https://example.test", { method: "POST",
        body: JSON.stringify({ ...input, selection: saved }) }),
    () => Promise.resolve({ admitted: true, data: { ...data,
      expires_at: expiresAt ?? new Date(now + 60_000).toISOString() } }))
    assert.equal(response.status, 200)
    return await response.json()
  }
  for (let request = 0; request < 3; request++) {
    const result = await read(selection)
    assert.equal(result.outcome, "accepted")
    assert.deepEqual(result.corrections, [])
    assert.ok(Date.parse(result.context.valid_until) >
      Date.parse(selection.valid_until))
    selection = result.context
  }
  assert.equal((await read(original)).outcome, "accepted")
  const extended = await read({ ...selection,
    valid_until: new Date(now + 120_000).toISOString() })
  assert.equal(extended.outcome, "stale")
  assert.ok(extended.corrections.some((issue: { code: string }) =>
    issue.code === "stale"))
  now = Date.parse(original.valid_until) - 1000
  const expired = await read(original)
  assert.equal(expired.outcome, "stale")
  assert.ok(expired.corrections.some((issue: { code: string }) =>
    issue.code === "expired"))
  assert.equal((await read(expired.context)).outcome, "accepted")
  const staleOwner = await read(expired.context, new Date(now).toISOString())
  assert.notEqual(staleOwner.outcome, "accepted")
  assert.ok(staleOwner.corrections.some((issue: { code: string }) =>
    issue.code === "expired"))
}
