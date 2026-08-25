import { readdir } from "node:fs/promises"
import { join } from "node:path"

import type { LoadedService, ServiceManifest } from "./types.ts"
import { readJson } from "./read_json.ts"
import { validateJson } from "./validate_json.ts"
import { serviceSchemaPath, workspaceRoot } from "./paths.ts"

export async function discoverServices(
  servicesPath: string,
  rootPath = workspaceRoot,
): Promise<LoadedService[]> {
  const root = join(rootPath, servicesPath)
  const entries = await readdir(root, { withFileTypes: true })
  const schema = await readJson<object>(serviceSchemaPath)
  const services: LoadedService[] = []

  for (const entry of entries) {
    const subject = `${servicesPath}/${entry.name}`
    if (entry.isSymbolicLink()) {
      throw new Error(`${subject}: service directory must not be a symlink`)
    }
    if (!entry.isDirectory()) {
      throw new Error(`${subject}: services may contain only service directories`)
    }
    const directory = join(root, entry.name)
    const manifest = await readJson<ServiceManifest>(
      join(directory, "service.json"),
    )
    validateJson(schema, manifest, `${servicesPath}/${entry.name}/service.json`)
    if (manifest.service_key !== entry.name) {
      throw new Error(`${entry.name}: directory and service_key must match`)
    }
    services.push({ directory, manifest })
  }

  return services.sort((left, right) =>
    left.manifest.service_key.localeCompare(right.manifest.service_key)
  )
}
