export function findMigrationHistoryViolations(
  baseline: Map<string, string>,
  current: Map<string, string>,
  serviceKeys: Set<string>,
): string[] {
  const violations: string[] = []
  const normalize = (value: string) => value.replaceAll("\r\n", "\n")
  for (const [name, source] of baseline) {
    const local = current.get(name)
    if (local === undefined) {
      violations.push(`${name}: production migration was deleted`)
    } else if (normalize(local) !== normalize(source)) {
      violations.push(`${name}: production migration was modified`)
    }
  }
  for (const [name, source] of current) {
    if (baseline.has(name)) continue
    const owner = source.match(/^-- service-owner: ([a-z][a-z0-9-]+)$/m)?.[1]
    if (!owner) {
      violations.push(`${name}: missing service-owner header`)
    } else if (!serviceKeys.has(owner)) {
      violations.push(`${name}: unknown service owner ${owner}`)
    }
  }
  return violations
}
