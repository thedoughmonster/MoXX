import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { assertFinalValidationState } from "../scripts/dev_loop/assert_final_validation_state.ts"
import { captureFinalValidationState } from "../scripts/dev_loop/capture_final_validation_state.ts"

test("development authority remains part of the resolved final plan", () => {
  const repository = mkdtempSync(join(tmpdir(), "momi-final-authority-"))
  const workspace = join(repository, "MoMi")
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
    writeFileSync(join(workspace, "fixture.txt"), "head\n")
    git(["commit", "--quiet", "-am", "head"])
    const head = git(["rev-parse", "HEAD"])
    const unrelated = git([
      "commit-tree", `${base}^{tree}`, "-p", head, "-m", "unrelated",
    ])
    assert.throws(() => captureFinalValidationState(
      base, head, workspace, "origin/prod", unrelated,
    ), /development baseline must equal the resolved base or head SHA/u)
    git(["branch", "trusted-development", base])
    const state = captureFinalValidationState(
      base, head, workspace, "origin/prod", "trusted-development",
    )
    git(["update-ref", "refs/heads/trusted-development", head])
    assert.throws(() => assertFinalValidationState(state),
      /development ref moved during checks; rerun from fresh refs/u)
  } finally {
    rmSync(repository, { recursive: true, force: true })
  }
})
