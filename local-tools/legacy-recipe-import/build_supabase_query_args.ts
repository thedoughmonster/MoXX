export function buildSupabaseQueryArgs(path: string, workspaceRoot: string): string[] {
  return [
    "db", "query", "--linked", "--file", path,
    "--workdir", workspaceRoot, "--output", "json",
  ]
}
