import { readFile, readdir } from "node:fs/promises"
import { join, relative, sep } from "node:path"

import type { WorkspaceConfig } from "./architecture/types.ts"
import { workspaceRoot } from "./architecture/paths.ts"
import { inspectSourceQualityFile } from "./inspect_source_quality_file.ts"
import { isSourceQualityPath } from "./is_source_quality_path.ts"

export type SourceQualityFindings = {
  warnings: string[]
  violations: string[]
}

export async function findSourceQualityFindings(
  workspace: WorkspaceConfig,
  root = workspaceRoot,
): Promise<SourceQualityFindings> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  const warnings: string[] = []
  const violations: string[] = []

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const path = join(entry.parentPath, entry.name)
    const normalized = relative(root, path).replaceAll(sep, "/")
    if (!isSourceQualityPath(normalized)) continue
    const source = await readFile(path, "utf8")
    for (const diagnostic of inspectSourceQualityFile(
      normalized,
      source,
      workspace.policies,
    )) {
      if (diagnostic.severity === "advisory") warnings.push(diagnostic.message)
      else violations.push(diagnostic.message)
    }
  }

  return { warnings, violations }
}
