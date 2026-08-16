import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join } from "node:path"

import type { CanonicalGenerator, GeneratorResult } from "./types.ts"

export async function runCanonicalGenerator(
  root: string,
  kind: CanonicalGenerator,
): Promise<GeneratorResult> {
  const script = kind === "catalog" ? "catalog:generate" : "quality:generate"
  const path = kind === "catalog"
    ? "docs/service-catalog.md"
    : "docs/quality-metrics.json"
  const absolute = join(root, path)
  const before = existsSync(absolute) ? readFileSync(absolute, "utf8") : null
  const result = spawnSync("pnpm", [script], {
    cwd: root,
    encoding: "utf8",
    timeout: 15_000,
  })
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout ||
      `exit ${String(result.status)}`
    throw new Error(`${script} failed: ${detail.trim().slice(0, 500)}`)
  }
  const after = readFileSync(absolute, "utf8")
  return {
    changed: before !== after,
    command: `pnpm ${script}`,
    kind,
    path,
  }
}
