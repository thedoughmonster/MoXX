import assert from "node:assert/strict"
import { basename } from "node:path"
import test from "node:test"
import { assertRetentionAppliedSources } from "../scripts/release/retention/assert_applied_sources.ts"
import { retentionMigrations, retentionVersions } from "../scripts/release/retention/policy.ts"

test("applied source readback requires exact versions, source names and immutable source hashes", () => {
  const versions = [...retentionVersions.prod]
  const rows = versions.map((version) => ({version,
    name:basename(retentionMigrations[version].file).slice(15,-4),sha256:retentionMigrations[version].sha256}))
  assert.doesNotThrow(() => assertRetentionAppliedSources(versions,rows))
  for (const altered of [rows.slice(1), [...rows,rows[0]], [...rows].reverse(),
    rows.map((row,index)=>index===0?{...row,sha256:"0".repeat(64)}:row),
    rows.map((row,index)=>index===0?{...row,name:"unrelated"}:row)]) {
    assert.throws(() => assertRetentionAppliedSources(versions,altered),/source differs/)
  }
})
