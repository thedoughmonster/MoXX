import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { findAuthorityViolations } from
  "../scripts/architecture/find_authority_violations.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import type { LoadedService } from "../scripts/architecture/types.ts"
import { loadWorkspace } from "../scripts/architecture/load_workspace.ts"

function service(
  key: string,
  lifecycle: "active" | "retiring",
  secrets: string[] = [],
  outboundHosts: string[] = [],
): LoadedService {
  return {
    directory: join(workspaceRoot, "services", key),
    manifest: {
      schema_version: 1,
      service_key: key,
      purpose: "Synthetic Toast authority regression fixture.",
      kind: "source_adapter",
      lifecycle_status: lifecycle,
      functions: [`${key}-v1`],
      contracts: { provides: [], consumes: [] },
      database: { read: [], write: [] },
      network: { outbound_hosts: outboundHosts },
      secrets,
      runtime_dependencies: [],
      approved_packages: [],
    },
  }
}

const workspace = await loadWorkspace()
const toastSecrets = ["TOAST_CLIENT_ID", "TOAST_CLIENT_SECRET"]
const toastHost = ["configured:toast.api_base_url"]

test("allows the permanent owner and explicitly retiring legacy adapter", () => {
  const acquisition = service("toast-data-acquisition", "active", toastSecrets, toastHost)
  const hydration = service("toast-order-hydration", "retiring", toastSecrets, toastHost)
  const violations = findAuthorityViolations(workspace, [acquisition, hydration], [{
    path: join(acquisition.directory, "src", "authenticate.ts"),
    service_key: "toast-data-acquisition",
    source: "Deno.env.get(source.clientSecretName); fetch('/authentication/v1/authentication')",
    imports: [],
  }, {
    path: join(hydration.directory, "src", "fetch.ts"),
    service_key: "toast-order-hydration",
    source: "fetch('/orders/v2/orders/id')",
    imports: [],
  }])
  assert.deepEqual(violations, [])
})

test("rejects Toast credentials declared by another dynamic secret reader", () => {
  const rogue = service("rogue-source", "active", ["TOAST_CLIENT_ID"], toastHost)
  const violations = findAuthorityViolations(workspace, [rogue], [{
    path: join(rogue.directory, "src", "authenticate.ts"),
    service_key: "rogue-source",
    source: "Deno.env.get(config.clientIdSecretName)",
    imports: [],
  }])
  assert.match(violations.join("\n"), /Toast outbound authority belongs to toast-data-acquisition/)
})

test("requires the legacy Toast adapter to be retiring", () => {
  const hydration = service("toast-order-hydration", "active", toastSecrets, toastHost)
  const violations = findAuthorityViolations(workspace, [hydration], [])
  assert.match(violations.join("\n"), /allowed only while retiring/)
})

test("rejects Toast API calls by every other service", () => {
  const rogue = service("rogue-source", "active")
  const violations = findAuthorityViolations(workspace, [rogue], [{
    path: join(rogue.directory, "src", "fetch.ts"),
    service_key: "rogue-source",
    source: "fetch('https://ws-api.toasttab.com/orders/v2/orders/id')",
    imports: [],
  }])
  assert.match(violations.join("\n"), /only toast-data-acquisition may call the Toast API/)
})
