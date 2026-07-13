import { readdir } from "node:fs/promises"
import { join } from "node:path"

import type { LoadedService, ServiceManifest } from "./types.ts"
import { readJson } from "./read_json.ts"
import { validateJson } from "./validate_json.ts"
import { serviceSchemaPath, workspaceRoot } from "./paths.ts"

export async function discoverServices(
  servicesPath: string,
): Promise<LoadedService[]> {
  const root = join(workspaceRoot, servicesPath)
  const entries = await readdir(root, { withFileTypes: true })
  const schema = await readJson<object>(serviceSchemaPath)
  const services: LoadedService[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    const directory = join(root, entry.name)
    const manifest = await readJson<ServiceManifest>(
      join(directory, "service.json"),
    )
    validateJson(schema, manifest, `${entry.name}/service.json`)
    if (manifest.service_key !== entry.name) {
      throw new Error(`${entry.name}: directory and service_key must match`)
    }
    services.push({ directory, manifest })
  }

  return services.sort((left, right) =>
    left.manifest.service_key.localeCompare(right.manifest.service_key)
  )
}
