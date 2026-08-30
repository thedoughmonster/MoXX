import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { hashDiff } from "../scripts/dev_loop/hash_diff.ts"

test("streams binary diffs larger than the child-process buffer", async () => {
  const repository = mkdtempSync(join(tmpdir(), "momi-hash-diff-"))
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: repository })
    execFileSync("git", ["config", "user.email", "momi-test@example.invalid"], {
      cwd: repository,
    })
    execFileSync("git", ["config", "user.name", "MoMi test"], { cwd: repository })
    execFileSync("git", ["commit", "--quiet", "--allow-empty", "-m", "base"], {
      cwd: repository,
    })
    const base = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repository,
      encoding: "utf8",
    }).trim()
    writeFileSync(join(repository, "fixture.bin"), randomBytes(1_500_000))
    execFileSync("git", ["add", "fixture.bin"], { cwd: repository })
    execFileSync("git", ["commit", "--quiet", "-m", "binary fixture"], {
      cwd: repository,
    })
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repository,
      encoding: "utf8",
    }).trim()
    const patch = execFileSync("git", [
      "diff", "--relative", "--binary", "--no-ext-diff", "--no-renames",
      `${base}...${head}`, "--", ".",
    ], { cwd: repository, maxBuffer: 8 * 1024 * 1024 })
    assert.ok(patch.length > 1024 * 1024)
    assert.equal(
      await hashDiff(base, head, repository),
      createHash("sha256").update(patch).digest("hex"),
    )
  } finally {
    rmSync(repository, { recursive: true, force: true })
  }
})
