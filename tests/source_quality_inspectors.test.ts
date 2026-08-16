import assert from "node:assert/strict"
import { mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { loadWorkspace } from "../scripts/architecture/load_workspace.ts"
import { findSourceQualityFindings } from "../scripts/find_source_quality_violations.ts"
import { inspectChangedSourceQuality } from "../scripts/inspect_changed_source_quality.ts"
import { inspectSourceQualityFile } from "../scripts/inspect_source_quality_file.ts"
import type { WorkspaceConfig } from "../scripts/architecture/types.ts"

const policies = {
  max_handwritten_lines: 120,
  hard_max_handwritten_lines: 140,
}
const workspace = {
  policies,
} as WorkspaceConfig

test("accepts a compliant handwritten TypeScript file", () => {
  assert.deepEqual(
    inspectSourceQualityFile("scripts/one.ts", "export function one() {}\n", policies),
    [],
  )
})

test("reports multiple top-level TypeScript functions structurally", () => {
  const diagnostics = inspectChangedSourceQuality(
    "scripts/two.ts",
    "export function one() {}\nexport const two = () => 2\n",
    workspace,
  )
  assert.deepEqual(diagnostics, [{
    code: "SOURCE_MULTIPLE_TOP_LEVEL_FUNCTIONS",
    path: "scripts/two.ts",
    severity: "error",
    actual: 2,
    limit: 1,
    repair_class: "BOUNDED_REFACTOR",
    message: "scripts/two.ts: 2 top-level functions",
  }])
})

test("distinguishes soft and hard handwritten line limits", () => {
  assert.deepEqual(
    inspectChangedSourceQuality("notes/soft.md", "line\n".repeat(121), workspace),
    [{
      code: "SOURCE_HANDWRITTEN_LINE_LIMIT",
      path: "notes/soft.md",
      severity: "advisory",
      actual: 121,
      limit: 120,
      repair_class: "BOUNDED_REFACTOR",
      message: "notes/soft.md: 121 lines (soft limit 120)",
    }],
  )
  assert.deepEqual(
    inspectChangedSourceQuality("notes/hard.md", "line\n".repeat(141), workspace),
    [{
      code: "SOURCE_HANDWRITTEN_LINE_LIMIT",
      path: "notes/hard.md",
      severity: "error",
      actual: 141,
      limit: 140,
      repair_class: "BOUNDED_REFACTOR",
      message: "notes/hard.md: 141 lines (hard limit 140)",
    }],
  )
})

test("reports TypeScript parse failures", () => {
  const diagnostics = inspectChangedSourceQuality(
    "scripts/broken.ts",
    "export function broken( {\n",
    workspace,
  )
  assert.ok(diagnostics.length > 0)
  assert.ok(diagnostics.every((item) => item.code === "SOURCE_TYPESCRIPT_PARSE_FAILURE"))
  assert.ok(diagnostics.every((item) => item.severity === "error"))
  assert.ok(diagnostics.every((item) => item.path === "scripts/broken.ts"))
  assert.ok(diagnostics.every((item) => item.repair_class === "SEMANTIC_REPAIR"))
})

test("preserves SQL and generated dependency exclusions", () => {
  const oversized = "line\n".repeat(141)
  assert.deepEqual(
    inspectChangedSourceQuality("supabase/migrations/example.sql", oversized, workspace),
    [],
  )
  assert.deepEqual(
    inspectChangedSourceQuality(
      "node_modules/generated.ts",
      `${oversized}function one() {}\nfunction two() {}\n`,
      workspace,
    ),
    [],
  )
  assert.deepEqual(
    inspectChangedSourceQuality("pnpm-lock.yaml", oversized, workspace),
    [],
  )
})

test("the repository scan catches violations when changed-file inspection is bypassed", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-source-quality-"))
  const path = join(root, "bypass.ts")
  await writeFile(path, "export function one() {}\nexport function two() {}\n")
  try {
    const findings = await findSourceQualityFindings(await loadWorkspace(), root)
    assert.deepEqual(findings.violations, ["bypass.ts: 2 top-level functions"])
  } finally {
    await unlink(path)
    await rmdir(root)
  }
})
