import assert from "node:assert/strict"
import test from "node:test"

import { executeMigrationRelease } from
  "../scripts/release/execute_migration_release.ts"
import type { MigrationReleaseIo } from
  "../scripts/release/migration_release_types.ts"

function makeIo(
  hostedSnapshots: string[][],
  preview: string,
  events: string[],
  applyError?: Error,
): MigrationReleaseIo {
  return {
    readHosted: () => {
      events.push("hosted")
      const versions = hostedSnapshots.shift() ?? []
      return JSON.stringify({ rows: versions.map((version) => ({ version })) })
    },
    preview: (includeAll) => {
      events.push(`preview:${includeAll}`)
      return preview
    },
    apply: (includeAll) => {
      events.push(`apply:${includeAll}`)
      if (applyError) throw applyError
    },
  }
}

test("previews and applies the same selected include-all path", () => {
  const events: string[] = []
  const io = makeIo(
    [
      ["20260102000000"],
      ["20260101000000", "20260102000000"],
    ],
    "DRY RUN: migrations will *not* be pushed to the database.\n" +
      "Would push these migrations:\n" +
      " • 20260101000000_first.sql\n",
    events,
  )
  executeMigrationRelease(
    ["20260101000000_first.sql", "20260102000000_second.sql"],
    ["20260101000000"],
    io,
  )
  assert.deepEqual(events, ["hosted", "preview:true", "apply:true", "hosted"])
})

test("rejects preview output with an extra or missing migration", () => {
  const local = [
    "20260101000000_first.sql",
    "20260102000000_second.sql",
    "20260103000000_third.sql",
  ]
  assert.throws(
    () => executeMigrationRelease(
      local,
      ["20260102000000"],
      makeIo(
        [["20260101000000", "20260103000000"]],
        "Would push these migrations:\n" +
          " • 20260102000000_second.sql\n" +
          " • 20260103000000_third.sql\n",
        [],
      ),
    ),
    /Migration preview differs;.*extra: 20260103000000_third\.sql/,
  )
  assert.throws(
    () => executeMigrationRelease(
      local,
      ["20260102000000"],
      makeIo([["20260101000000", "20260103000000"]], "Remote database is up to date.\n", []),
    ),
    /Migration preview differs; missing: 20260102000000_second\.sql/,
  )
})

test("stops on apply failure before the final history query", () => {
  const events: string[] = []
  const io = makeIo(
    [["20260101000000"], ["20260101000000", "20260102000000"]],
    "Would push these migrations:\n" +
      " • 20260102000000_second.sql\n",
    events,
    new Error("apply failed"),
  )
  assert.throws(
    () => executeMigrationRelease(
      ["20260101000000_first.sql", "20260102000000_second.sql"],
      ["20260102000000"],
      io,
    ),
    /apply failed/,
  )
  assert.deepEqual(events, ["hosted", "preview:false", "apply:false"])
})

test("fails when final hosted parity is incomplete", () => {
  const io = makeIo(
    [["20260101000000"], ["20260101000000"]],
    "Would push these migrations:\n" +
      " • 20260102000000_second.sql\n",
    [],
  )
  assert.throws(
    () => executeMigrationRelease(
      ["20260101000000_first.sql", "20260102000000_second.sql"],
      ["20260102000000"],
      io,
    ),
    /Migration history differs; missing remote: 20260102000000/,
  )
})
