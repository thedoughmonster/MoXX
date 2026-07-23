export function parseMigrationPreview(source: string): string[] {
  const lines = source.replaceAll("\r\n", "\n").split("\n")
  const headers = lines.flatMap((line, index) =>
    line === "Would push these migrations:" ? [index] : []
  )
  const upToDate = lines.filter((line) =>
    line === "Remote database is up to date."
  ).length
  const migrationLike = lines.filter((line) =>
    line.includes("Would push") ||
    line.trimStart().startsWith("•") ||
    /\d{14}_[a-z0-9_]+\.sql/.test(line)
  )
  if (headers.length === 0) {
    if (upToDate === 1 && migrationLike.length === 0) return []
    throw new Error("Migration preview did not contain a recognized exact result")
  }
  if (headers.length !== 1 || upToDate !== 0) {
    throw new Error("Migration preview contained ambiguous result sections")
  }
  const header = headers[0]
  const bullets = lines.flatMap((line, index) =>
    line.trimStart().startsWith("•") ? [{ index, line }] : []
  )
  if (
    bullets.length === 0 ||
    bullets.some((bullet, offset) => bullet.index !== header + offset + 1)
  ) {
    throw new Error("Migration preview contained a malformed migration list")
  }
  const filenames = bullets.map((bullet) => {
    const filename = bullet.line.match(
      /^ • (\d{14}_[a-z0-9_]+\.sql)$/,
    )?.[1]
    if (!filename) {
      throw new Error("Migration preview contained an invalid migration filename")
    }
    return filename
  })
  const listed = new Set(bullets.map((bullet) => bullet.index))
  const unlisted = lines.some((line, index) =>
    !listed.has(index) && /\d{14}_[a-z0-9_]+\.sql/.test(line)
  )
  if (unlisted || new Set(filenames).size !== filenames.length) {
    throw new Error("Migration preview contained ambiguous migration filenames")
  }
  return filenames
}
