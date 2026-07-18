export function findUnqualifiedRelationReferences(
  source: string,
  knownNames: Set<string>,
): string[] {
  const ctes = new Set(
    [...source.matchAll(
      /(?:\bwith(?:\s+recursive)?|,)\s*([a-z_][a-z0-9_]*)\s*(?:\([^)]*\)\s*)?as\s*(?:(?:not\s+)?materialized\s+)?\(/gi,
    )].map((match) => match[1].toLowerCase()),
  )
  const references = [...source.matchAll(
    /\b(?:from|join|insert\s+into|update|delete\s+from|merge\s+into|truncate(?:\s+table)?)\s+(?:only\s+)?([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi,
  )].map((match) => match[1].toLowerCase())
    .filter((name) => !name.includes(".") && knownNames.has(name) && !ctes.has(name))
  return [...new Set(references)].sort()
}
