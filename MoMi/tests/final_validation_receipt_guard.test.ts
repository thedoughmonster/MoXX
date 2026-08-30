import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { assertFinalValidationState } from
  "../scripts/dev_loop/assert_final_validation_state.ts"
import { captureFinalValidationState } from
  "../scripts/dev_loop/capture_final_validation_state.ts"
import { runValidation } from "../scripts/dev_loop/run_validation.ts"

test("ref movement prevents replacing a stale final receipt", () => {
  const repository = mkdtempSync(join(tmpdir(), "momi-final-receipt-"))
  const workspace = join(repository, "MoMi")
  const receipt = `${repository}-receipt.json`
  const git = (args: string[]) => execFileSync("git", args, {
    cwd: repository, encoding: "utf8",
  }).trim()
  try {
    git(["init", "--quiet"])
    git(["config", "user.email", "momi-test@example.invalid"])
    git(["config", "user.name", "MoMi test"])
    mkdirSync(workspace)
    writeFileSync(join(workspace, "fixture.txt"), "base\n")
    git(["add", "."])
    git(["commit", "--quiet", "-m", "base"])
    const base = git(["rev-parse", "HEAD"])
    git(["update-ref", "refs/remotes/origin/prod", base])
    git(["branch", "receipt-base", base])
    writeFileSync(join(workspace, "fixture.txt"), "head\n")
    git(["commit", "--quiet", "-am", "head"])
    const head = git(["rev-parse", "HEAD"])
    const state = captureFinalValidationState(
      "receipt-base", head, workspace, "origin/prod",
    )
    writeFileSync(receipt, "stale pass\n")
    assert.throws(() => runValidation({ kind: "validation", receipt_path: receipt,
      execution_binding: { assert_invariants: () =>
        assertFinalValidationState(state) }, checks: [{
        id: "move-ref", command: process.execPath, enforcement: "hard_stop",
        args: ["-e", `require("node:child_process").execFileSync("git",
          ["update-ref", "refs/heads/receipt-base", "${head}"],
          { cwd: ${JSON.stringify(repository)} })`],
      }] }), /base ref moved during checks/u)
    assert.equal(existsSync(receipt), false)
  } finally {
    rmSync(repository, { recursive: true, force: true })
    rmSync(receipt, { force: true })
  }
})
