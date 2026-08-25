import { readdir } from "node:fs/promises"
import { posix } from "node:path"

export async function findAdrNumberViolations(
  decisionsDirectory: string,
  repositoryDirectory = "docs/decisions",
): Promise<string[]> {
  const groups = new Map<string, string[]>()
  const entries = await readdir(decisionsDirectory, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const prefix = entry.name.match(/^(\d{4})-.+\.md$/)?.[1]
    if (!prefix) continue
    const paths = groups.get(prefix) ?? []
    paths.push(posix.join(repositoryDirectory, entry.name))
    groups.set(prefix, paths)
  }

  return [...groups.entries()]
    .filter(([, paths]) => paths.length > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([prefix, paths]) =>
      `Duplicate ADR prefix ${prefix}: ${paths.sort().join(", ")}`
    )
}
