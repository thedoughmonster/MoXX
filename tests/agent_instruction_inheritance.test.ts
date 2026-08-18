import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import type { LoadedFunction } from "../scripts/architecture/types.ts"
import { validateArchitecture } from
  "../scripts/architecture/validate_architecture.ts"

const adapterAgentExceptions = new Map<string, string>()

function validateAdapterAgentFiles(
  functions: LoadedFunction[],
  adapterAgentPaths: Set<string>,
): void {
  for (const [slug, reason] of adapterAgentExceptions) {
    assert.match(
      reason,
      /\S/,
      `${slug}: adapter AGENTS.md exception needs a deployment-only reason`,
    )
  }
  for (const loadedFunction of functions) {
    const path = join(loadedFunction.adapter_directory, "AGENTS.md")
    if (
      adapterAgentPaths.has(path) &&
      !adapterAgentExceptions.has(loadedFunction.slug)
    ) {
      throw new Error(
        `${loadedFunction.slug}: unexpected adapter-local instructions at ${path}`,
      )
    }
  }
}

test("states canonical adapter instruction inheritance", async () => {
  const guidancePath = join(workspaceRoot, "supabase", "functions", "AGENTS.md")
  const guidance = await readFile(guidancePath, "utf8")

  assert.match(
    guidance,
    /Direct function directories inherit repository-root, this adapter-tree,\n  owning-service, and applicable source-function rules\./,
  )
  assert.match(
    guidance,
    /Do not add `supabase\/functions\/<slug>\/AGENTS\.md` unless it records a named\n  deployment-only invariant not expressed by inherited rules; never copy\n  inherited prose\./,
  )
  assert.doesNotMatch(
    guidance,
    /Give every direct function directory a local `AGENTS\.md`/,
  )
})

test("rejects stale adapter copies and preserves source rules", async () => {
  const architecture = await validateArchitecture()
  const adapterAgentPaths = new Set(
    architecture.functions
      .map((loadedFunction) =>
        join(loadedFunction.adapter_directory, "AGENTS.md")
      )
      .filter(existsSync),
  )
  validateAdapterAgentFiles(architecture.functions, adapterAgentPaths)

  const sample = architecture.functions.find((loadedFunction) =>
    loadedFunction.slug === "momi-preorder-payment-initiate-v1"
  )
  assert.ok(sample)
  const syntheticPath = join(sample.adapter_directory, "AGENTS.md")
  assert.throws(
    () => validateAdapterAgentFiles(
      architecture.functions,
      new Set([syntheticPath]),
    ),
    {
      message:
        `${sample.slug}: unexpected adapter-local instructions at ${syntheticPath}`,
    },
  )
  adapterAgentExceptions.set(sample.slug, "")
  assert.throws(
    () => validateAdapterAgentFiles(architecture.functions, new Set()),
    {
      message:
        `${sample.slug}: adapter AGENTS.md exception needs a deployment-only reason`,
    },
  )
  adapterAgentExceptions.delete(sample.slug)

  for (const slug of [
    "momi-preorder-payment-initiate-v1",
    "momi-preorder-payment-reconcile-v1",
  ]) {
    const loadedFunction = architecture.functions.find((item) =>
      item.slug === slug
    )
    assert.ok(loadedFunction)
    assert.ok(existsSync(join(loadedFunction.source_directory, "AGENTS.md")))
    assert.equal(
      existsSync(join(loadedFunction.adapter_directory, "AGENTS.md")),
      false,
    )
  }
})
