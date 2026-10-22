import assert from "node:assert/strict"
import test from "node:test"
import { assertRetentionAfter } from "../scripts/release/retention/assert_after.ts"

test("requires exact additions and preserves every prior ledger hash including unknown versions", () => {
  const known = { version: "20000101000000", sha256: "1".repeat(64) }
  const unknown = { version: "20000301000000", sha256: "2".repeat(64) }
  const added = { version: "20000201000000", sha256: "3".repeat(64) }
  const last = { version: "20000401000000", sha256: "4".repeat(64) }
  const before = { ledger: [known, unknown], ledger_sha256: "5".repeat(64), objects_sha256: "6".repeat(64) }
  const after = { ledger: [known, added, unknown, last], ledger_sha256: "7".repeat(64), objects_sha256: "8".repeat(64) }
  const additions = [added.version, last.version]
  assert.doesNotThrow(() => assertRetentionAfter(before, after, additions))
  assert.doesNotThrow(() => assertRetentionAfter(before, after, [...additions].reverse()))
  assert.doesNotThrow(() => assertRetentionAfter(before, before, []))
  for (const ledger of [
    [known, added, last], [added, unknown, last],
    [known, unknown, last], [known, added, unknown],
    [...after.ledger, { version: "20000501000000", sha256: "9".repeat(64) }],
    [known, added, added, unknown, last], [...after.ledger].reverse(),
    [{ ...known, sha256: "0".repeat(64) }, added, unknown, last],
    [known, added, { ...unknown, sha256: "0".repeat(64) }, last],
  ]) {
    assert.throws(() => assertRetentionAfter(before, { ...after, ledger }, additions),
      /changed preserved history or added unexpected versions/)
  }
  assert.throws(() => assertRetentionAfter(before, after, [added.version]))
  assert.throws(() => assertRetentionAfter(before, after, [...additions, "20000501000000"]))
})
