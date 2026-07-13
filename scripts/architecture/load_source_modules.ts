import { readFile } from "node:fs/promises"

import type { LoadedFunction, SourceModule } from "./types.ts"
import { collectTypeScriptFiles } from "./collect_typescript_files.ts"
import { extractImports } from "./extract_imports.ts"

export async function loadSourceModules(
  functions: LoadedFunction[],
): Promise<SourceModule[]> {
  const modules: SourceModule[] = []

  for (const loadedFunction of functions) {
    const paths = await collectTypeScriptFiles(loadedFunction.source_directory)
    for (const path of paths) {
      const source = await readFile(path, "utf8")
      modules.push({
        path,
        service_key: loadedFunction.service.manifest.service_key,
        source,
        imports: extractImports(path, source),
      })
    }
  }

  return modules
}
