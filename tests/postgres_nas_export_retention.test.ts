import assert from "node:assert/strict"
import test from "node:test"

import { selectPrunableArchives } from
  "../local-tools/postgres-nas-export/select_prunable_archives.ts"
import type { ArchiveSummary } from "../local-tools/postgres-nas-export/types.ts"

test("keeps 30 daily points plus monthly and annual points", () => {
  const archives: ArchiveSummary[] = []
  const start = new Date("2025-11-28T12:00:00.000Z")
  for (let index = 0; index < 399; index += 1) {
    const date = new Date(start.getTime() + index * 86_400_000)
    archives.push({
      archiveId: date.toISOString().slice(0, 10),
      createdAt: date.toISOString(),
      environment: "prod",
      projectRef: "abcdefghijklmnopqrst",
    })
  }
  const prunable = new Set(selectPrunableArchives(archives).map((item) => item.archiveId))
  assert.equal(prunable.has("2026-12-31"), false)
  assert.equal(prunable.has("2026-12-01"), true)
  assert.equal(prunable.has("2026-06-30"), false)
  assert.equal(prunable.has("2026-06-29"), true)
  assert.equal(prunable.has("2025-12-31"), false)
  assert.equal(prunable.has("2025-12-30"), true)
})

test("retains only the newest point when many exports share one day", () => {
  const archives: ArchiveSummary[] = []
  for (let index = 0; index < 35; index += 1) {
    archives.push({
      archiveId: `same-day-${index}`,
      createdAt: `2026-07-14T12:00:${String(index).padStart(2, "0")}.000Z`,
      environment: "dev",
      projectRef: "tsrqponmlkjihgfedcba",
    })
  }
  const prunable = selectPrunableArchives(archives)
  assert.equal(prunable.length, 34)
  assert.equal(prunable.some((item) => item.archiveId === "same-day-34"), false)
})

test("calculates retention independently for each environment and project", () => {
  const archives: ArchiveSummary[] = [
    {
      archiveId: "dev-new",
      createdAt: "2026-07-14T12:00:01.000Z",
      environment: "dev",
      projectRef: "tsrqponmlkjihgfedcba",
    },
    {
      archiveId: "prod-new",
      createdAt: "2026-07-14T12:00:00.000Z",
      environment: "prod",
      projectRef: "abcdefghijklmnopqrst",
    },
  ]
  assert.deepEqual(selectPrunableArchives(archives), [])
})
