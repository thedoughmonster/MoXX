export function parseProductionMigrationTree(
  source: string,
  migrationPath: string,
): Map<string, string> {
  const root = migrationPath.replace(/\/+$/, "")
  const prefix = `${root}/`
  const sources = new Map<string, string>()
  const paths = new Set<string>()
  for (const line of source.split(/\r?\n/).filter(Boolean)) {
    const match = line.match(
      /^([0-9]{6}) (blob|tree|commit) ([0-9a-f]{40})\t(.+)$/,
    )
    if (!match || !match[4].startsWith(prefix)) {
      throw new Error("Production migration baseline has an invalid tree entry")
    }
    const path = match[4].slice(prefix.length)
    if (paths.has(path)) {
      throw new Error(`${path}: duplicate production migration path`)
    }
    paths.add(path)
    if (path.includes("/")) {
      throw new Error(`${path}: production migration inventory must be flat`)
    }
    if (path !== "AGENTS.md" && !path.endsWith(".sql")) {
      throw new Error(`${path}: unexpected production migration inventory entry`)
    }
    if (match[1] !== "100644" || match[2] !== "blob") {
      throw new Error(
        `${path}: production migration must be a regular, non-executable file`,
      )
    }
    if (path === "AGENTS.md") continue
    if (sources.has(path)) {
      throw new Error(`${path}: duplicate production migration basename`)
    }
    sources.set(path, `git-blob-sha1:${match[3]}`)
  }
  return sources
}
