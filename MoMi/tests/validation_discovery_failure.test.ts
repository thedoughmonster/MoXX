import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"

import type { CompactReceipt } from "../scripts/dev_loop/types.ts"

test("canonical entry points capture test discovery failures", () => {
  for (const [index, entry] of ["scripts/check.ts", "scripts/run_check.ts",
    "scripts/run_tests.ts"].entries()) {
    const receiptPath = `.momi/discovery-failure-${index}.json`
    const result = spawnSync(process.execPath, [entry, "--service",
      "fixture-missing", "--receipt", receiptPath], { encoding: "utf8" })
    assert.equal(result.status, 1, entry)
    assert.match(result.stdout, /Failure: tests-fixture-missing/u, entry)
    assert.match(result.stdout,
      /inspect: cat -- \.momi\/logs\/run-[^/]+\/tests-fixture-missing\.stdout\.log \.momi\/logs\/run-[^/]+\/tests-fixture-missing\.stderr\.log/u,
      entry)
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as CompactReceipt
    const failure = receipt.commands.find((item) => item.id === "tests-fixture-missing")
    assert.equal(failure?.status, 1, entry)
    assert.match(failure?.failure_excerpt ?? "", /Unknown service: fixture-missing/u)
  }
})
