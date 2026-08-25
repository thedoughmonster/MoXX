export function sqlLiteral(value: string | null): string {
  return value === null ? "null" : `'${value.replaceAll("'", "''")}'`
}
