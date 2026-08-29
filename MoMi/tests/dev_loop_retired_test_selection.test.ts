import assert from "node:assert/strict"
import test from "node:test"

import { selectTestPaths } from "../scripts/dev_loop/select_test_paths.ts"
import type { ImpactClass } from "../scripts/dev_loop/types.ts"

test("repository plans skip deleted tests", () => {
  const classes = {
    architecture: [], docs: [], manifest: [], migration: [],
    repository_tooling: ["tests/deleted.test.ts"], runtime: [], unknown: [],
    workflow: [],
  } satisfies Record<ImpactClass, string[]>
  const selected = selectTestPaths(classes, [], [])
  assert.ok(!selected.includes("tests/deleted.test.ts"))
})
