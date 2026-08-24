import assert from "node:assert/strict"
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { runPostWriteDiagnostics } from
  "../scripts/codex_hooks/run_post_write_diagnostics.ts"
import type { CanonicalGenerator } from "../scripts/codex_hooks/types.ts"

const policies = { max_handwritten_lines: 120, hard_max_handwritten_lines: 140 }

test("filters non-edit events without invoking work", async () => {
  let invoked = false
  const diagnostics = await runPostWriteDiagnostics({
    hook_event_name: "PostToolUse",
    tool_name: "Bash",
    tool_input: { command: "echo unchanged" },
  }, {
    policies,
    root: workspaceRoot,
    runGenerator: async (_root, kind) => {
      invoked = true
      return { changed: false, command: kind, kind, path: kind }
    },
  })
  assert.deepEqual(diagnostics, [])
  assert.equal(invoked, false)
})

test("reports a targeted service-manifest schema failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-post-write-manifest-"))
  await mkdir(join(root, "schemas"))
  await mkdir(join(root, "services", "demo"), { recursive: true })
  await cp(
    join(workspaceRoot, "schemas", "service-manifest-v1.schema.json"),
    join(root, "schemas", "service-manifest-v1.schema.json"),
  )
  await writeFile(join(root, "services", "demo", "service.json"), "{}\n")
  try {
    const diagnostics = await runPostWriteDiagnostics({
      hook_event_name: "PostToolUse",
      tool_name: "apply_patch",
      tool_input: { command: "*** Update File: services/demo/service.json" },
    }, {
      policies,
      root,
      runGenerator: async (_root, kind) => (
        { changed: false, command: `pnpm ${kind}`, kind, path: kind }
      ),
    })
    assert.equal(
      diagnostics.find((item) => item.code === "MANIFEST_SCHEMA_INVALID")?.path,
      "services/demo/service.json",
    )
    const manifest = diagnostics.find((item) =>
      item.code === "MANIFEST_SCHEMA_INVALID")?.repository_diagnostic
    assert.equal(manifest?.rule_id, "MANIFEST_SCHEMA_INVALID")
    assert.match(manifest?.expected ?? "", /service_key demo/u)
    assert.deepEqual(manifest?.repair, { kind: "none" })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("runs and reports only the two canonical generators", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-post-write-generators-"))
  await mkdir(join(root, "docs"))
  await writeFile(join(root, "docs", "service-catalog.md"), "stale\n")
  const generators: CanonicalGenerator[] = []
  try {
    const diagnostics = await runPostWriteDiagnostics({
      hook_event_name: "PostToolUse",
      tool_name: "apply_patch",
      tool_input: { command: "*** Update File: docs/service-catalog.md" },
    }, {
      policies,
      root,
      runGenerator: async (_root, kind) => {
        generators.push(kind)
        return {
          changed: true,
          command: kind === "catalog" ? "pnpm catalog:generate" : "pnpm quality:generate",
          kind,
          path: kind === "catalog"
            ? "docs/service-catalog.md"
            : "docs/quality-metrics.json",
        }
      },
    })
    assert.deepEqual(generators, ["catalog", "quality"])
    assert.deepEqual(
      diagnostics.map((item) => [item.code, item.repair_class]),
      [
        ["GENERATED_SERVICE_CATALOG_UPDATED", "AUTO_FIX"],
        ["GENERATED_QUALITY_METRICS_UPDATED", "AUTO_FIX"],
      ],
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
