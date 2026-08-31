import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { assertFinalValidationState } from "../scripts/dev_loop/assert_final_validation_state.ts"
import { captureFinalValidationState } from "../scripts/dev_loop/capture_final_validation_state.ts"

test("final validation binds one clean committed base and HEAD", async (context) => {
  const repository = mkdtempSync(join(tmpdir(), "momi-final-boundary-"))
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

    await context.test("clean committed and detached HEAD candidates pass", () => {
      const attached = captureFinalValidationState(base, "HEAD", workspace,
        "origin/prod", base)
      assert.equal(attached.base.sha, base)
      assert.equal(attached.head.sha, head)
      assert.equal(attached.development.sha, base)
      assert.equal(attached.head.tree, git(["rev-parse", "HEAD^{tree}"]))
      assert.doesNotThrow(() => assertFinalValidationState(attached))
      git(["checkout", "--quiet", "--detach", head])
      const detached = captureFinalValidationState(base, head, workspace,
        "origin/prod", base)
      assert.equal(detached.head.sha, head)
      assert.doesNotThrow(() => assertFinalValidationState(detached))
    })

    await context.test("unstaged tracked changes reject before checks", () => {
      writeFileSync(join(workspace, "fixture.txt"), "dirty\n")
      assert.throws(
        () => captureFinalValidationState(
          base, head, workspace, "origin/prod", base,
        ),
        /clean repository; commit or discard tracked changes: MoMi\/fixture\.txt/u,
      )
      git(["restore", "."])
    })

    await context.test("staged uncommitted changes reject before checks", () => {
      writeFileSync(join(workspace, "fixture.txt"), "staged\n")
      git(["add", "."])
      assert.throws(
        () => captureFinalValidationState(
          base, head, workspace, "origin/prod", base,
        ),
        /clean repository; commit or unstage indexed changes: MoMi\/fixture\.txt/u,
      )
      git(["reset", "--quiet", "--hard", head])
    })

    await context.test("untracked files and a mismatched candidate reject", () => {
      writeFileSync(join(workspace, "untracked.txt"), "not committed\n")
      assert.throws(
        () => captureFinalValidationState(
          base, head, workspace, "origin/prod", base,
        ),
        /clean repository; remove or commit untracked files: MoMi\/untracked\.txt/u,
      )
      rmSync(join(workspace, "untracked.txt"))
      assert.throws(
        () => captureFinalValidationState(
          base, base, workspace, "origin/prod", base,
        ),
        /head must equal checked-out HEAD; checkout/u,
      )
    })

    await context.test("moving symbolic base rejects completion", () => {
      git(["branch", "moving-base", base])
      const state = captureFinalValidationState("moving-base", head, workspace,
        "origin/prod", base)
      git(["update-ref", "refs/heads/moving-base", head])
      assert.throws(
        () => assertFinalValidationState(state),
        /base ref moved during checks; rerun with the resolved base SHA/u,
      )
    })

    await context.test("post-plan dirtiness rejects receipt completion", () => {
      const state = captureFinalValidationState(
        base, head, workspace, "origin/prod", base,
      )
      writeFileSync(join(workspace, "fixture.txt"), "changed during checks\n")
      assert.throws(
        () => assertFinalValidationState(state),
        /repository changed during checks; restore the clean committed HEAD/u,
      )
      git(["restore", "."])
    })

    await context.test("checkout and production ref movement reject completion", () => {
      const checkoutState = captureFinalValidationState(base, head, workspace,
        "origin/prod", base)
      git(["checkout", "--quiet", "--detach", base])
      assert.throws(
        () => assertFinalValidationState(checkoutState),
        /Checked-out HEAD moved during final validation/u,
      )
      git(["checkout", "--quiet", "--detach", head])
      const productionState = captureFinalValidationState(base, head, workspace,
        "origin/prod", base)
      git(["update-ref", "refs/remotes/origin/prod", head])
      assert.throws(
        () => assertFinalValidationState(productionState),
        /production ref moved during checks; rerun from fresh refs/u,
      )
    })
  } finally {
    rmSync(repository, { recursive: true, force: true })
  }
})
