import type { DevelopmentMigrationCorrection } from
  "./find_migration_history_violations.ts"

export function findDevelopmentMigrationChangeViolations(
  source: string,
  migrationPath: string,
  productionNames: Set<string>,
  correctedNames: Set<string> = new Set(),
  renameCorrections: Map<string, DevelopmentMigrationCorrection> = new Map(),
): string[] {
  const prefix = `${migrationPath.replace(/\/+$/, "")}/`
  const records: Array<{
    commit: string
    from: string
    to: string
    status: "A" | "M" | "D"
    name: string
  }> = []
  const states = new Map<string, "added" | "deleted">()
  const violations: string[] = []
  let commit = ""
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("commit:")) {
      commit = line.slice("commit:".length)
      continue
    }
    const match = line.match(
      /^:[0-7]{6} [0-7]{6} ([0-9a-f]{40}) ([0-9a-f]{40}) ([AMD])\t(.+)$/,
    )
    if (!match || !match[4].startsWith(prefix)) continue
    records.push({
      commit,
      from: match[1],
      to: match[2],
      status: match[3] as "A" | "M" | "D",
      name: match[4].slice(prefix.length),
    })
  }
  const replacements = new Set<string>()
  for (const [name, correction] of renameCorrections) {
    if (!correction.replacement) continue
    if (replacements.has(correction.replacement)) {
      violations.push(
        `${name}: duplicate development migration replacement ${correction.replacement}`,
      )
    }
    replacements.add(correction.replacement)
  }
  for (const record of records) {
    const name = record.name
    if (!name.endsWith(".sql") || productionNames.has(name)) continue
    const state = states.get(name)
    if (record.status === "A") {
      if (state) violations.push(`${name}: development migration was re-added`)
      states.set(name, "added")
    } else if (record.status === "M") {
      if (!correctedNames.has(name)) {
        violations.push(`${name}: development migration changed after landing`)
      }
    } else {
      const correction = renameCorrections.get(name)
      const replacement = correction?.replacement
      const paired = records.some((candidate) =>
        candidate.commit === record.commit && candidate.status === "A" &&
        candidate.name === replacement &&
        correction?.from === `git-blob-sha1:${record.from}` &&
        correction.to === `git-blob-sha1:${candidate.to}`
      )
      if (!paired) {
        violations.push(`${name}: development migration was deleted after landing`)
      }
      states.set(name, "deleted")
    }
  }
  return [...new Set(violations)].sort()
}
