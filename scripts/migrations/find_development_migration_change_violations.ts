export function findDevelopmentMigrationChangeViolations(
  source: string,
  migrationPath: string,
  productionNames: Set<string>,
): string[] {
  const prefix = `${migrationPath.replace(/\/+$/, "")}/`
  const states = new Map<string, "added" | "deleted">()
  const violations: string[] = []
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([AMD])\t(.+)$/)
    if (!match || !match[2].startsWith(prefix)) continue
    const name = match[2].slice(prefix.length)
    if (!name.endsWith(".sql") || productionNames.has(name)) continue
    const state = states.get(name)
    if (match[1] === "A") {
      if (state) violations.push(`${name}: development migration was re-added`)
      states.set(name, "added")
    } else if (match[1] === "M") {
      violations.push(`${name}: development migration changed after landing`)
    } else {
      violations.push(`${name}: development migration was deleted after landing`)
      states.set(name, "deleted")
    }
  }
  return [...new Set(violations)].sort()
}
