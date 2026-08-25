import { readdir } from "node:fs/promises"
import { join } from "node:path"

import type { LoadedService, RetirementManifest } from "./types.ts"
import { readJson } from "./read_json.ts"
import { retirementSchemaPath, workspaceRoot } from "./paths.ts"
import { validateJson } from "./validate_json.ts"

export async function loadRetirements(
  directory: string,
  services: LoadedService[],
): Promise<RetirementManifest[]> {
  const root = join(workspaceRoot, directory)
  const schema = await readJson<object>(retirementSchemaPath)
  const serviceKeys = new Set(services.map((service) => service.manifest.service_key))
  const files = (await readdir(root)).filter((file) => file.endsWith(".json"))
  const retirements: RetirementManifest[] = []
  const keys = new Set<string>()
  for (const file of files.sort()) {
    const manifest = await readJson<RetirementManifest>(join(root, file))
    validateJson(schema, manifest, `retirements/${file}`)
    if (!serviceKeys.has(manifest.owner_service)) {
      throw new Error(`${file}: unknown owner ${manifest.owner_service}`)
    }
    for (const environment of manifest.environments) {
      const key = `${environment}:${manifest.function_slug}`
      if (keys.has(key)) throw new Error(`${file}: duplicate retirement ${key}`)
      keys.add(key)
    }
    retirements.push(manifest)
  }
  return retirements
}
