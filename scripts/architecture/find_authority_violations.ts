import { sep } from "node:path"

import type {
  LoadedService,
  SourceModule,
  WorkspaceConfig,
} from "./types.ts"

export function findAuthorityViolations(
  workspace: WorkspaceConfig,
  services: LoadedService[],
  modules: SourceModule[],
): string[] {
  const violations: string[] = []
  const byKey = new Map(services.map((service) => [service.manifest.service_key, service]))

  for (const service of services) {
    const authority = service.manifest
    const toastOwner = authority.service_key === "toast-data-acquisition" ||
      (authority.service_key === "toast-order-hydration" &&
        authority.lifecycle_status === "retiring")
    const declaresToastCredentials = authority.secrets.some((secret) =>
      secret === "TOAST_CLIENT_ID" || secret === "TOAST_CLIENT_SECRET"
    )
    const declaresToastHost = authority.network.outbound_hosts.some((host) =>
      host.toLowerCase().includes("toast")
    )
    if ((declaresToastCredentials || declaresToastHost) && !toastOwner) {
      violations.push(
        `${service.directory}/service.json: Toast outbound authority belongs to ` +
          "toast-data-acquisition; toast-order-hydration is allowed only while retiring",
      )
    }
  }

  for (const module of modules) {
    const path = module.path.replaceAll(sep, "/")
    if (path.includes("/tests/")) {
      continue
    }
    const service = byKey.get(module.service_key)
    if (!service) {
      continue
    }
    const authority = service.manifest
    for (const match of module.source.matchAll(/Deno\.env\.get\(["']([^"']+)["']\)/g)) {
      if (!authority.secrets.includes(match[1])) {
        violations.push(`${module.path}: undeclared secret ${match[1]}`)
      }
    }
    for (const schema of workspace.database_schemas) {
      if (
        module.source.includes(`${schema}.`) &&
        !authority.database.read.includes(schema) &&
        !authority.database.write.includes(schema)
      ) {
        violations.push(`${module.path}: undeclared database schema ${schema}`)
      }
    }
    if (
      /\bfetch(?:Impl)?\s*\(/.test(module.source) &&
      authority.network.outbound_hosts.length === 0
    ) {
      violations.push(`${module.path}: outbound HTTP is not declared`)
    }
    if (module.source.includes("slack.com") && module.service_key !== "slack-order-delivery") {
      violations.push(`${module.path}: only Slack delivery may call slack.com`)
    }
    const toastOwner = module.service_key === "toast-data-acquisition" ||
      (module.service_key === "toast-order-hydration" &&
        authority.lifecycle_status === "retiring")
    if (
      /orders\/v2\/orders|authentication\/v1\/authentication|toasttab\.com|Toast-Restaurant-External-ID/
        .test(module.source) &&
      !toastOwner
    ) {
      violations.push(
        `${module.path}: only toast-data-acquisition may call the Toast API; ` +
          "toast-order-hydration is allowed only while retiring",
      )
    }
  }

  return violations
}
