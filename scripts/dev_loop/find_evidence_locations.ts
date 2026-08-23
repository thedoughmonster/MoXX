const token = /[^\s()]+/gu
const digits = /^\d+$/u

export function findEvidenceLocations(line: string): {
  locations: string[]
  normalized: string
} {
  const locations: string[] = []
  const normalized: string[] = []
  let cursor = 0
  for (const match of line.matchAll(token)) {
    const source = match[0]
    const candidate = source.endsWith(",") ? source.slice(0, -1) : source
    const lastColon = candidate.lastIndexOf(":")
    if (lastColon <= 0 || !digits.test(candidate.slice(lastColon + 1))) continue
    const previousColon = candidate.lastIndexOf(":", lastColon - 1)
    const hasColumn = previousColon > 0 &&
      digits.test(candidate.slice(previousColon + 1, lastColon))
    const pathEnd = hasColumn ? previousColon : lastColon
    if (pathEnd <= 0) continue
    locations.push(candidate)
    const start = match.index ?? 0
    normalized.push(line.slice(cursor, start), "<location>")
    cursor = start + candidate.length
  }
  normalized.push(line.slice(cursor))
  return { locations, normalized: normalized.join("") }
}
