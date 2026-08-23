import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import test from "node:test"

import { loadWorkspace } from "../scripts/architecture/load_workspace.ts"
import { classifyHandwrittenLineCount } from "../scripts/classify_handwritten_line_count.ts"
import { findSourceQualityFindings } from "../scripts/find_source_quality_violations.ts"

test("source quality uses a 120-line soft limit and 140-line hard limit", async () => {
  const workspace = await loadWorkspace()
  assert.equal(workspace.policies.max_handwritten_lines, 120)
  assert.equal(workspace.policies.hard_max_handwritten_lines, 140)
})

test("CI separates soft-limit advisories from hard failures", async () => {
  const hard = await readFile("scripts/check_source_quality.ts", "utf8")
  const soft = await readFile("scripts/check_source_quality_soft_limit.ts", "utf8")
  assert.match(soft, /Source quality soft-limit advisories:/)
  assert.match(soft, /process\.exitCode = 1/)
  assert.doesNotMatch(hard, /warnings/)
  assert.match(hard, /if \(violations\.length > 0\)/)
})

test("the quality entry point keeps soft findings visible and nonblocking", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"))
  assert.match(packageJson.scripts["quality:check"],
    /^node scripts\/check_source_quality_soft_limit\.ts --nonblocking &&/)
  const result = spawnSync(process.execPath,
    ["scripts/check_source_quality_soft_limit.ts", "--nonblocking"],
    { encoding: "utf8" })
  assert.equal(result.status, 0)
  assert.match(result.stderr, /Source quality soft-limit advisories:/)
})

test("the line-count boundaries are deterministic", () => {
  assert.equal(classifyHandwrittenLineCount(120, 120, 140), "valid")
  assert.equal(classifyHandwrittenLineCount(121, 120, 140), "warning")
  assert.equal(classifyHandwrittenLineCount(140, 120, 140), "warning")
  assert.equal(classifyHandwrittenLineCount(141, 120, 140), "violation")
})

test("repository scanning excludes only ignored generated artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-source-quality-ignore-"))
  const ignored = [
    ".momi/receipt.md",
    ".momi-postgres-export/evidence.md",
    "supabase/.branches/receipt with space\nand newline.md",
    "supabase/.temp/cache.md",
  ]
  const preserved = [
    ".momi/tracked.md",
    "src/untracked.md",
    "scratch/ignored.md",
  ]
  try {
    assert.equal(spawnSync("git", ["init", "-b", "dev"], { cwd: root }).status, 0)
    await writeFile(join(root, ".gitignore"), [
      ".momi/",
      ".momi-postgres-export/",
      "supabase/.branches/",
      "supabase/.temp/",
      "scratch/",
      "",
    ].join("\n"))
    await Promise.all([...ignored, ...preserved].map(async (path) => {
      const absolute = join(root, path)
      await mkdir(dirname(absolute), { recursive: true })
      await writeFile(absolute, "line\n".repeat(141))
    }))
    const bulkDirectory = join(root, ".momi", "bulk")
    await mkdir(bulkDirectory)
    for (let index = 0; index < 11_000; index += 1) {
      await writeFile(join(bulkDirectory, `${index}-${"x".repeat(90)}.md`), "")
    }
    assert.equal(
      spawnSync("git", ["add", "-f", ".momi/tracked.md"], { cwd: root }).status,
      0,
    )

    const findings = await findSourceQualityFindings(await loadWorkspace(), root)
    assert.deepEqual(findings.warnings, [])
    assert.deepEqual(findings.violations.sort(), preserved.map(
      (path) => `${path}: 141 lines (hard limit 140)`,
    ).sort())
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
