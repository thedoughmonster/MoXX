export function isRelationInvocationContext(source: string, index: number): boolean {
  const prefix = source.slice(Math.max(0, index - 240), index)
  return /(?:insert\s+into|update|delete\s+from|merge\s+into|references|create\s+(?:or\s+replace\s+)?(?:(?:unlogged|temporary|temp)\s+)?(?:table|(?:materialized\s+)?view)|create\s+(?:unique\s+)?index\b[\s\S]*\bon)\s*$/i
    .test(prefix)
}
