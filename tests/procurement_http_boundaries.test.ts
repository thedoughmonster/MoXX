import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { findAuthorityViolations } from
  "../scripts/architecture/find_authority_violations.ts"
import { loadWorkspace } from "../scripts/architecture/load_workspace.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("procurement cannot call an internal MoMi HTTP route", async () => {
  const procurement = service("source-procurement")
  procurement.manifest.kind = "source_adapter"
  procurement.manifest.service_type = "procurement_adapter"
  procurement.manifest.network.outbound_hosts = ["configured:source.api_base_url"]
  const findings = findAuthorityViolations(
    await loadWorkspace(),
    [procurement],
    [{
      path: join(workspaceRoot, "services/source-procurement/src/fetch.ts"),
      service_key: "source-procurement",
      source: "fetch('https://project.supabase.co/functions/v1/internal')",
      imports: [],
    }],
  )
  assert.match(findings.join("\n"), /procurement cannot call a MoMi-owned HTTP route/)
})
