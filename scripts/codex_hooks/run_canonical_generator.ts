import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join } from "node:path"

import { canonicalGeneratorIdentity } from
  "./canonical_generator_identity.ts"
import type { CanonicalGenerator, GeneratorResult } from "./types.ts"

export async function runCanonicalGenerator(
  root: string,
  kind: CanonicalGenerator,
): Promise<GeneratorResult> {
  const identity = canonicalGeneratorIdentity(kind)
  const absolute = join(root, identity.path)
  const before = existsSync(absolute) ? readFileSync(absolute, "utf8") : null
  const result = spawnSync("pnpm", [identity.script], {
    cwd: root,
    encoding: "utf8",
    timeout: 15_000,
  })
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout ||
      `exit ${String(result.status)}`
    throw new Error(`${identity.script} failed: ${detail.trim().slice(0, 500)}`)
  }
  const after = readFileSync(absolute, "utf8")
  return {
    changed: before !== after,
    command: identity.command,
    kind,
    path: identity.path,
  }
}
