import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { assertFinalValidationState } from
  "../scripts/dev_loop/assert_final_validation_state.ts"
import { captureFinalValidationState } from
  "../scripts/dev_loop/capture_final_validation_state.ts"
import { createFinalValidationCheckout } from
  "../scripts/dev_loop/create_final_validation_checkout.ts"
import { executeChecks } from "../scripts/dev_loop/execute_checks.ts"
import { removeFinalValidationCheckout } from
  "../scripts/dev_loop/remove_final_validation_checkout.ts"
import { setFinalValidationCheckoutWritable } from
  "../scripts/dev_loop/set_final_validation_checkout_writable.ts"
import type { FinalValidationState } from
  "../scripts/dev_loop/final_validation_types.ts"

test("final checks use a locked detached candidate checkout", () => {
  const repository = mkdtempSync(join(tmpdir(), "momi-final-source-"))
  const checkoutRoot = `${repository}-checkout`
  const workspace = join(repository, "MoMi")
  let checkout: FinalValidationState | undefined
  const git = (args: string[]) => execFileSync("git", args, {
    cwd: repository, encoding: "utf8",
  }).trim()
  try {
    git(["init", "--quiet"])
    git(["config", "user.email", "momi-test@example.invalid"])
    git(["config", "user.name", "MoMi test"])
    mkdirSync(workspace)
    mkdirSync(join(workspace, "node_modules"))
    writeFileSync(join(repository, ".gitignore"),
      "MoMi/.momi/\nMoMi/node_modules\n")
    writeFileSync(join(workspace, "fixture.txt"), "base\n")
    git(["add", "."])
    git(["commit", "--quiet", "-m", "base"])
    const base = git(["rev-parse", "HEAD"])
    git(["update-ref", "refs/remotes/origin/prod", base])
    writeFileSync(join(workspace, "fixture.txt"), "head\n")
    git(["commit", "--quiet", "-am", "head"])
    const head = git(["rev-parse", "HEAD"])
    const source = captureFinalValidationState(
      base, head, workspace, "origin/prod", base,
    )
    checkout = createFinalValidationCheckout(source, checkoutRoot)
    const scratch = join(checkout.workspace_root, ".momi", "tmp")
    setFinalValidationCheckoutWritable(checkout.repository_root, [
      join(checkout.workspace_root, ".momi"), scratch,
    ], false)
    const [liveMutation, checkoutMutation] = executeChecks([{
      id: "transient-live-mutation", command: process.execPath,
      enforcement: "hard_stop", args: ["-e", `const fs=require("node:fs");
        const live=${JSON.stringify(join(workspace, "fixture.txt"))};
        fs.writeFileSync(live,"transient\\n");
        const observed=fs.readFileSync("fixture.txt","utf8");
        fs.writeFileSync(live,"head\\n");
        process.exit(observed==="head\\n"?0:9)`],
    }, {
      id: "locked-candidate", command: process.execPath,
      enforcement: "hard_stop", args: ["-e", `const fs=require("node:fs");
        try{fs.writeFileSync("fixture.txt","mutated\\n");process.exit(9)}
        catch{process.exit(0)}`],
    }], {
      workspace_root: checkout.workspace_root,
      environment: { TMPDIR: scratch },
      assert_invariants: () => {
        assertFinalValidationState(source)
        assertFinalValidationState(checkout!)
      },
    })
    assert.equal(liveMutation.status, 0)
    assert.equal(checkoutMutation.status, 0)
    assert.equal(git(["status", "--porcelain"]), "")
  } finally {
    if (checkout) removeFinalValidationCheckout(repository, checkout.repository_root)
    rmSync(repository, { recursive: true, force: true })
    rmSync(checkoutRoot, { recursive: true, force: true })
  }
})
