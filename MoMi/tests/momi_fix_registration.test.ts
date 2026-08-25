import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { momiFixes } from "../scripts/momi_fix/registrations.ts"
import { runMomiFix } from "../scripts/momi_fix/run_momi_fix.ts"
import { runRegisteredFix } from "../scripts/momi_fix/run_registered_fix.ts"

test("keeps one closed record for every eligible generator", () => {
  assert.deepEqual(momiFixes, {
    catalog: {
      id: "catalog", script: "catalog:generate",
      outputs: ["docs/service-catalog.md"],
      validation_command: "pnpm catalog:check",
    },
    quality: {
      id: "quality", script: "quality:generate",
      outputs: ["docs/quality-metrics.json"],
      validation_command: "pnpm quality:check",
    },
    "debt-lifecycle": {
      id: "debt-lifecycle", script: "debt-lifecycle:generate",
      outputs: ["docs/debt-lifecycle-trend.json"],
      validation_command: "pnpm constitution:check",
    },
    "legacy-access-report": {
      id: "legacy-access-report", script: "legacy-access-report:generate",
      outputs: ["docs/legacy-access-governance-report.json"],
      validation_command: "pnpm legacy-access-report:check",
    },
  })
  assert.equal(Object.hasOwn(momiFixes, "broad-schema-overlap"), false)
  assert.equal(Object.hasOwn(momiFixes, "service-dependency-graph"), false)
})

test("keeps generation and observational validation as separate scripts", async () => {
  const packageJson = JSON.parse(await readFile(
    join(workspaceRoot, "package.json"), "utf8",
  )) as { scripts: Record<string, string> }
  for (const fix of Object.values(momiFixes)) {
    assert.equal(typeof packageJson.scripts[fix.script], "string")
    const validationScript = fix.validation_command.replace("pnpm ", "")
    assert.equal(typeof packageJson.scripts[validationScript], "string")
    assert.doesNotMatch(packageJson.scripts[validationScript], /momi-fix/u)
  }
})

test("delegates every eligible registration without duplicating generation", async () => {
  for (const fix of Object.values(momiFixes)) {
    const root = await mkdtemp(join(tmpdir(), `momi-fix-${fix.id}-`))
    try {
      const output = fix.outputs[0]
      await mkdir(dirname(join(root, output)), { recursive: true })
      const receipt = await runRegisteredFix(root, fix, async (_root, kind) => {
        assert.equal(kind, fix.id)
        await writeFile(join(root, output), `${kind}\n`)
        return { changed: true, command: `pnpm ${fix.script}`, kind, path: output }
      })
      assert.deepEqual(receipt, {
        changed_paths: [output],
        delegated_command: `pnpm ${fix.script}`,
        fix_id: fix.id,
        validation_command: fix.validation_command,
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
})

test("refuses unknown IDs and malformed input before generator invocation", async () => {
  let invoked = false
  const runner = async () => {
    invoked = true
    throw new Error("must not run")
  }
  await assert.rejects(
    runMomiFix(["run", "unknown"], ".", runner),
    /Unknown fix ID: unknown/u,
  )
  for (const args of [["catalog"], ["run", "catalog", "extra"],
    ["run", "catalog", "--unknown"]]) {
    await assert.rejects(runMomiFix(args, ".", runner))
  }
  assert.equal(invoked, false)
})
