import { join } from "node:path"

import type { LoadedFunction } from "./types.ts"
import { readJson } from "./read_json.ts"

type DenoConfig = { imports?: Record<string, string> }

export async function findDependencyViolations(
  functions: LoadedFunction[],
): Promise<string[]> {
  const violations: string[] = []

  for (const loadedFunction of functions) {
    const config = await readJson<DenoConfig>(
      join(loadedFunction.adapter_directory, "deno.json"),
    )
    const declared = loadedFunction.service.manifest.runtime_dependencies
    for (const dependency of Object.values(config.imports ?? {})) {
      if (!/^(?:npm:(?:@[^/]+\/)?[^@/]+|jsr:@[^/]+\/[^@/]+)@\d+\.\d+\.\d+(?:\/.*)?$/.test(
        dependency,
      ) || dependency.split("/").includes("..")) {
        violations.push(`${loadedFunction.slug}: unsafe dependency target ${dependency}`)
      }
      if (!declared.includes(dependency)) {
        violations.push(`${loadedFunction.slug}: undeclared dependency ${dependency}`)
      }
    }
    for (const dependency of declared) {
      if (!Object.values(config.imports ?? {}).includes(dependency)) {
        violations.push(`${loadedFunction.slug}: dependency not pinned in deno.json: ${dependency}`)
      }
    }
  }

  return violations
}
