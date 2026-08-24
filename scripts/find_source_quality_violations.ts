import { spawnSync } from "node:child_process"
import { readFile, readdir } from "node:fs/promises"
import { join, relative, sep } from "node:path"

import type { WorkspaceConfig } from "./architecture/types.ts"
import { workspaceRoot } from "./architecture/paths.ts"
import { inspectSourceQualityFile } from "./inspect_source_quality_file.ts"
import { isSourceQualityPath } from "./is_source_quality_path.ts"
import type { SourceQualityDiagnostic } from "./source_quality_types.ts"

const generatedPrefixes = [
  ".momi/",
  ".momi-postgres-export/",
  "supabase/.branches/",
  "supabase/.temp/",
]

export type SourceQualityFindings = {
  warningDiagnostics: SourceQualityDiagnostic[]
  warnings: string[]
  violationDiagnostics: SourceQualityDiagnostic[]
  violations: string[]
}

export async function findSourceQualityFindings(
  workspace: WorkspaceConfig,
  root = workspaceRoot,
): Promise<SourceQualityFindings> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  const candidates: Array<{ normalized: string; path: string }> = []
  const warningDiagnostics: SourceQualityDiagnostic[] = []
  const warnings: string[] = []
  const violationDiagnostics: SourceQualityDiagnostic[] = []
  const violations: string[] = []

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const path = join(entry.parentPath, entry.name)
    const normalized = relative(root, path).replaceAll(sep, "/")
    if (!isSourceQualityPath(normalized)) continue
    candidates.push({ normalized, path })
  }

  const input = candidates.length === 0 ? "" :
    `${candidates.map(({ normalized }) => normalized).join("\0")}\0`
  const classification = spawnSync("git", ["check-ignore", "--stdin", "-z"], {
    cwd: root,
    encoding: "utf8",
    input,
    maxBuffer: Math.max(1024 * 1024, Buffer.byteLength(input) + 64 * 1024),
  })
  if (classification.status !== 0 && classification.status !== 1) {
    const detail = classification.error?.message || classification.stderr.trim()
    throw new Error(`Git ignore classification failed: ${detail || "unknown error"}`)
  }
  const ignored = new Set(classification.stdout.split("\0").filter(Boolean))

  for (const { normalized, path } of candidates) {
    if (
      ignored.has(normalized) &&
      generatedPrefixes.some((prefix) => normalized.startsWith(prefix))
    ) continue
    const source = await readFile(path, "utf8")
    for (const diagnostic of inspectSourceQualityFile(
      normalized,
      source,
      workspace.policies,
    )) {
      if (diagnostic.severity === "advisory") {
        warningDiagnostics.push(diagnostic)
        warnings.push(diagnostic.message)
      } else {
        violationDiagnostics.push(diagnostic)
        violations.push(diagnostic.message)
      }
    }
  }

  return {
    warningDiagnostics,
    warnings: warnings.sort(),
    violationDiagnostics,
    violations: violations.sort(),
  }
}
