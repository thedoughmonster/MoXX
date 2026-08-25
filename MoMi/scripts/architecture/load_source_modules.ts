import { readFile } from "node:fs/promises"

import type { LoadedService, SourceModule } from "./types.ts"
import { collectTypeScriptFiles } from "./collect_typescript_files.ts"
import { extractImports } from "./extract_imports.ts"

export async function loadSourceModules(
  services: LoadedService[],
): Promise<SourceModule[]> {
  const modules: SourceModule[] = []

  for (const service of services) {
    const paths = await collectTypeScriptFiles(service.directory)
    for (const path of paths) {
      const source = await readFile(path, "utf8")
      modules.push({
        path,
        service_key: service.manifest.service_key,
        source,
        imports: extractImports(path, source),
      })
    }
  }

  return modules.sort((left, right) => left.path.localeCompare(right.path))
}
