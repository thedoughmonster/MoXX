import { readdir } from "node:fs/promises"
import { join, relative, sep } from "node:path"

import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { workspaceRoot } from "./architecture/paths.ts"

export async function discoverTestFiles(serviceKey: string): Promise<string[]> {
  const architecture = await validateArchitecture()
  const entries = await readdir(workspaceRoot, { recursive: true, withFileTypes: true })
  const allTests = entries.filter((entry) =>
    entry.isFile() && entry.name.endsWith(".test.ts") &&
    !entry.parentPath.includes(`${sep}node_modules${sep}`)
  ).map((entry) => join(entry.parentPath, entry.name))

  if (serviceKey === "all") {
    return allTests.sort()
  }
  const service = architecture.services.find((candidate) =>
    candidate.manifest.service_key === serviceKey
  )
  if (!service) {
    throw new Error(`Unknown service: ${serviceKey}`)
  }
  const slugs = new Set(service.manifest.functions)
  return allTests.filter((path) => {
    const normalized = relative(workspaceRoot, path).replaceAll(sep, "/")
    return normalized.startsWith("tests/") ||
      normalized.startsWith(`services/${serviceKey}/`) ||
      [...slugs].some((slug) =>
        normalized.startsWith(`supabase/functions/${slug}/`)
      )
  }).sort()
}
