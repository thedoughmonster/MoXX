import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import type { LoadedFunction, WorkspaceConfig } from "./types.ts"
import { extractImports } from "./extract_imports.ts"

export async function findAdapterViolations(
  workspace: WorkspaceConfig,
  functions: LoadedFunction[],
): Promise<string[]> {
  const violations: string[] = []

  for (const loadedFunction of functions) {
    const path = join(loadedFunction.adapter_directory, "index.ts")
    const source = await readFile(path, "utf8")
    const imports = extractImports(path, source)
    const handlers = imports.filter((specifier) =>
      specifier.endsWith("handle_request.ts")
    )
    if (handlers.length !== 1 || !imports.includes("edge-runtime")) {
      violations.push(`${loadedFunction.slug}: adapter must import one handler and Edge Runtime types`)
    }
    if (!/Deno\.serve\(handleRequest\)\s*$/.test(source.trim())) {
      violations.push(`${loadedFunction.slug}: adapter must only register handleRequest`)
    }
    if (workspace.layout === "service_workspaces") {
      const expected = `../../../services/${loadedFunction.service.manifest.service_key}` +
        `/functions/${loadedFunction.slug}/src/handle_request.ts`
      if (handlers[0] !== expected) {
        violations.push(`${loadedFunction.slug}: adapter must import ${expected}`)
      }
      const entries = await readdir(loadedFunction.adapter_directory)
      const unexpected = entries.filter((entry) =>
        entry !== "index.ts" && entry !== "deno.json"
      )
      if (unexpected.length > 0) {
        violations.push(`${loadedFunction.slug}: adapter contains ${unexpected.join(", ")}`)
      }
    }
  }

  return violations
}
