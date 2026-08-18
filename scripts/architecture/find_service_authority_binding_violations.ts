import { readdir } from "node:fs/promises"
import { join } from "node:path"

import { compareUtf16 } from "./compare_utf16.ts"
import { loadServiceAuthorityBindingContext } from
  "./load_service_authority_binding_context.ts"
import { readJson } from "./read_json.ts"
import { resolveServiceAuthorityBinding } from
  "./resolve_service_authority_binding.ts"
import type {
  ServiceAuthorityBinding,
  ServiceAuthorityBindingTrustContext,
} from "./service_authority_binding_types.ts"
import type { LoadedService } from "./types.ts"
import { workspaceRoot } from "./paths.ts"

export async function findServiceAuthorityBindingViolations(
  services: LoadedService[],
  root = workspaceRoot,
  trust?: ServiceAuthorityBindingTrustContext,
): Promise<string[]> {
  const directory = join(root, "service-authority-bindings")
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
  const schema = await readJson<object>(join(
    root, "schemas", "service-authority-binding-v1.schema.json",
  ))
  const context = await loadServiceAuthorityBindingContext(
    root, services, trust?.revision ?? "", trust?.execution ?? { grants: {} },
  )
  const violations: string[] = []
  const identities = new Set<string>()
  for (const entry of entries.sort((left, right) =>
    compareUtf16(left.name, right.name))) {
    const label = `service-authority-bindings/${entry.name}`
    if (entry.isSymbolicLink() || !entry.isFile() ||
      !entry.name.endsWith(".json")) {
      violations.push(`${label}: only JSON files are allowed`)
      continue
    }
    const binding = await readJson<ServiceAuthorityBinding>(join(directory,
      entry.name))
    const identity = `${binding.service}\0${binding.revision}`
    if (identities.has(identity)) {
      violations.push(`${label}: duplicate binding identity ${identity}`)
    }
    identities.add(identity)
    const resolution = await resolveServiceAuthorityBinding(
      binding, schema, context,
    )
    violations.push(...resolution.diagnostics.map((item) =>
      `${label}${item.json_pointer}: ${item.code}: ${item.target}`))
  }
  return violations.sort(compareUtf16)
}
