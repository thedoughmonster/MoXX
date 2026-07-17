import { createHash } from "node:crypto"

export function findMigrationHistoryViolations(
  baseline: Map<string, string>,
  current: Map<string, string>,
  serviceKeys: Set<string>,
): string[] {
  const violations: string[] = []
  const normalize = (value: string) => value.replaceAll("\r\n", "\n")
  for (const name of [...baseline.keys()].sort()) {
    const source = baseline.get(name) as string
    const local = current.get(name)
    if (local === undefined) {
      violations.push(`${name}: production migration was deleted`)
    } else if (source.startsWith("git-blob-sha1:")) {
      const bytes = Buffer.from(normalize(local), "utf8")
      const hash = createHash("sha1")
        .update(`blob ${bytes.length}\0`).update(bytes).digest("hex")
      if (source !== `git-blob-sha1:${hash}`) {
        violations.push(`${name}: production migration was modified`)
      }
    } else if (normalize(local) !== normalize(source)) {
      violations.push(`${name}: production migration was modified`)
    }
  }
  for (const name of [...current.keys()].sort()) {
    if (baseline.has(name)) continue
    const lines = normalize(current.get(name) as string).split("\n")
    const candidates = lines.map((line, index) => ({ line, index }))
      .filter(({ line }) => /^\s*--\s*service-owner\b/i.test(line))
    if (candidates.length === 0) {
      violations.push(`${name}: missing service-owner header`)
      continue
    }
    if (candidates.length > 1) {
      violations.push(
        `${name}: expected exactly one service-owner header, found ${candidates.length}`,
      )
      continue
    }
    if (candidates[0].index !== 0) {
      violations.push(`${name}: service-owner header must be on physical line 1`)
      continue
    }
    const owner = candidates[0].line.match(
      /^-- service-owner: ([a-z][a-z0-9-]+)$/,
    )?.[1]
    if (!owner) {
      violations.push(`${name}: malformed service-owner header on physical line 1`)
    } else if (!serviceKeys.has(owner)) {
      violations.push(`${name}: unknown service owner ${owner}`)
    }
  }
  return violations
}
