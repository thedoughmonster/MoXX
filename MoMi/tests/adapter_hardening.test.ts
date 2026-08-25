import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { findAdapterViolations } from
  "../scripts/architecture/find_adapter_violations.ts"
import type { LoadedFunction, WorkspaceConfig } from
  "../scripts/architecture/types.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("allows only registration statements in deployable adapters", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-adapter-"))
  try {
    const owner = service("records-owner")
    const slug = "records-owner-v1"
    const handler = `../../../services/records-owner/functions/${slug}/src/handle_request.ts`
    const valid = `import "edge-runtime"\n` +
      `import { handleRequest } from "${handler}"\n\n` +
      "Deno.serve(handleRequest)\n"
    await writeFile(join(root, "index.ts"), valid)
    await writeFile(join(root, "deno.json"), "{}\n")
    const loaded: LoadedFunction = {
      adapter_directory: root,
      source_directory: join(owner.directory, "functions", slug, "src"),
      manifest_directory: join(owner.directory, "functions", slug),
      slug,
      service: owner,
      manifest: {
        function_key: "fixture.records.read.v1",
        contract_version: 1,
        purpose: "Synthetic adapter hardening function fixture.",
        owner_service: "records-owner",
        function_type: "read",
        capability: "read",
        boundary: "momi_internal",
        runtime: "supabase_edge",
        route_path: `/functions/v1/${slug}`,
        authentication_policy_key: "fixture.v1",
        entrypoint: "index.ts",
        input_schema: "contracts/input.schema.json",
        output_schema: "contracts/output.schema.json",
        required_capabilities: [],
        declared_side_effects: [],
      },
    }
    const workspace = { layout: "service_workspaces" } as WorkspaceConfig
    assert.deepEqual(await findAdapterViolations(workspace, [loaded]), [])
    await writeFile(join(root, "index.ts"), "const hidden = 'sql'\n" + valid)
    assert.match(
      (await findAdapterViolations(workspace, [loaded])).join("\n"),
      /adapter must only register handleRequest/,
    )
    await writeFile(join(root, "index.ts"),
      `import "edge-runtime"\n` +
      `import { backdoor as handleRequest } from "${handler}"\n` +
      "Deno.serve(handleRequest)\n")
    assert.match(
      (await findAdapterViolations(workspace, [loaded])).join("\n"),
      /adapter must only register handleRequest/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
