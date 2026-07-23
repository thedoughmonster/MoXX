export function parseMigrationPreview(source: string): string[] {
  const matches = [...source.matchAll(
    /Would push migration (\d{14}_[a-z0-9_]+\.sql)\.\.\./g,
  )]
  const mentions = source.match(/Would push migration /g)?.length ?? 0
  if (matches.length !== mentions) {
    throw new Error("Migration preview contained an invalid migration filename")
  }
  return matches.map((match) => match[1])
}
