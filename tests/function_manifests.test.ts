import assert from "node:assert/strict"
import { access, readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import test from "node:test"

import {
  renderFunctionCatalog,
  type FunctionManifest,
} from "../scripts/function_catalog.ts"

const root = fileURLToPath(new URL("../", import.meta.url))
const functionsRoot = join(root, "supabase", "functions")
const capabilities = new Set(["ingest", "hydrate", "read", "decide", "deliver"])
const boundaries = new Set([
  "toast_inbound",
  "toast_outbound",
  "momi_internal",
  "slack_outbound",
])
const requiredStrings = [
  "function_key",
  "purpose",
  "owner_service",
  "function_type",
  "capability",
  "boundary",
  "runtime",
  "route_path",
  "authentication_policy_key",
  "entrypoint",
  "input_schema",
  "output_schema",
]

test("keeps complete manifests and the service catalog synchronized", async () => {
  const entries = await readdir(functionsRoot, { withFileTypes: true })
  const manifests: FunctionManifest[] = []
  const functionKeys = new Set<string>()

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const directory = join(functionsRoot, entry.name)
    await access(join(directory, "README.md"))
    await access(join(directory, "AGENTS.md"))
    const source = await readFile(join(directory, "function.json"), "utf8")
    const manifest = JSON.parse(source) as Record<string, unknown>

    for (const field of requiredStrings) {
      assert.equal(typeof manifest[field], "string", `${entry.name}: ${field}`)
      assert.ok(String(manifest[field]).trim(), `${entry.name}: ${field}`)
    }

    assert.equal(manifest.contract_version, 1, entry.name)
    assert.equal(manifest.runtime, "supabase_edge", entry.name)
    assert.ok(capabilities.has(String(manifest.capability)), entry.name)
    assert.ok(boundaries.has(String(manifest.boundary)), entry.name)
    assert.equal(
      manifest.route_path,
      `/functions/v1/${entry.name}`,
      entry.name,
    )
    assert.ok(Array.isArray(manifest.required_capabilities), entry.name)
    assert.ok(Array.isArray(manifest.declared_side_effects), entry.name)

    await access(join(directory, String(manifest.entrypoint)))
    await access(join(directory, String(manifest.input_schema)))
    await access(join(directory, String(manifest.output_schema)))

    const functionKey = String(manifest.function_key)
    assert.equal(functionKeys.has(functionKey), false, functionKey)
    functionKeys.add(functionKey)
    manifests.push(manifest as FunctionManifest)
  }

  assert.equal(manifests.length, 5)
  const catalog = await readFile(join(root, "docs", "service-catalog.md"), "utf8")
  assert.equal(catalog, renderFunctionCatalog(manifests))
})
