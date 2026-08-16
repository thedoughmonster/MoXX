import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { runPostWriteDiagnostics } from
  "../scripts/codex_hooks/run_post_write_diagnostics.ts"
import type { CanonicalGenerator } from "../scripts/codex_hooks/types.ts"

const policies = { max_handwritten_lines: 120, hard_max_handwritten_lines: 140 }

test("reports shared source diagnostics for only affected files", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-post-write-source-"))
  await mkdir(join(root, "scripts"))
  await writeFile(
    join(root, "scripts", "two.ts"),
    "export function one() {}\nexport const two = () => 2\n",
  )
  const generators: CanonicalGenerator[] = []
  try {
    const diagnostics = await runPostWriteDiagnostics({
      hook_event_name: "PostToolUse",
      tool_name: "apply_patch",
      tool_input: { command: "*** Update File: scripts/two.ts" },
    }, {
      policies,
      root,
      runGenerator: async (_root, kind) => {
        generators.push(kind)
        return { changed: false, command: `pnpm ${kind}`, kind, path: kind }
      },
    })
    assert.equal(diagnostics[0].code, "SOURCE_MULTIPLE_TOP_LEVEL_FUNCTIONS")
    assert.equal(diagnostics[0].path, "scripts/two.ts")
    assert.equal(diagnostics[0].severity, "error")
    assert.equal(diagnostics[0].repair_class, "BOUNDED_REFACTOR")
    assert.deepEqual(diagnostics[0].evidence.actual, 2)
    assert.deepEqual(generators, ["quality"])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("distinguishes soft, hard, and parse diagnostics", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-post-write-severity-"))
  await mkdir(join(root, "notes"))
  await mkdir(join(root, "scripts"))
  await writeFile(join(root, "notes", "soft.md"), "line\n".repeat(121))
  await writeFile(join(root, "notes", "hard.md"), "line\n".repeat(141))
  await writeFile(join(root, "scripts", "broken.ts"), "export function broken( {\n")
  try {
    const diagnostics = await runPostWriteDiagnostics({
      hook_event_name: "PostToolUse",
      tool_name: "apply_patch",
      tool_input: { command: [
        "*** Update File: notes/soft.md",
        "*** Update File: notes/hard.md",
        "*** Update File: scripts/broken.ts",
      ].join("\n") },
    }, {
      policies,
      root,
      runGenerator: async (_root, kind) => (
        { changed: false, command: `pnpm ${kind}`, kind, path: kind }
      ),
    })
    const soft = diagnostics.find((item) => item.path === "notes/soft.md")
    const hard = diagnostics.find((item) => item.path === "notes/hard.md")
    const parse = diagnostics.find((item) => item.path === "scripts/broken.ts")
    assert.equal(soft?.severity, "advisory")
    assert.equal(hard?.severity, "error")
    assert.equal(parse?.code, "SOURCE_TYPESCRIPT_PARSE_FAILURE")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("turns an inspector exception into an actionable diagnostic", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-post-write-failure-"))
  await mkdir(join(root, "broken.ts"))
  try {
    const diagnostics = await runPostWriteDiagnostics({
      hook_event_name: "PostToolUse",
      tool_name: "apply_patch",
      tool_input: { command: "*** Update File: broken.ts" },
    }, {
      policies,
      root,
      runGenerator: async (_root, kind) => (
        { changed: false, command: `pnpm ${kind}`, kind, path: kind }
      ),
    })
    assert.equal(diagnostics[0].code, "POST_WRITE_INSPECTOR_FAILURE")
    assert.equal(diagnostics[0].severity, "error")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
