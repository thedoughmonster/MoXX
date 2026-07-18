export function buildSupabaseArgs(
  args: string[],
): string[] {
  if (args.some((arg) => arg === "--debug" || arg.startsWith("--debug="))) {
    throw new Error("Supabase CLI --debug is forbidden by release policy")
  }
  return [...args]
}
