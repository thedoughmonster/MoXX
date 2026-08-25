import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { findDependencyViolations } from
  "../scripts/architecture/find_dependency_violations.ts"
import type { LoadedFunction } from "../scripts/architecture/types.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("rejects local and traversal import-map dependency targets", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-dependencies-"))
  try {
    const owner = service("records-owner")
    const loaded = {
      adapter_directory: root,
      slug: "records-owner-v1",
      service: owner,
    } as LoadedFunction
    for (const dependency of [
      "../../../services/other-owner/src/private.ts",
      "npm:postgres@3.4.3/../other",
    ]) {
      owner.manifest.runtime_dependencies = [dependency]
      await writeFile(join(root, "deno.json"), JSON.stringify({
        imports: { provider: dependency },
      }))
      assert.match(
        (await findDependencyViolations([loaded])).join("\n"),
        /unsafe dependency target/,
      )
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
