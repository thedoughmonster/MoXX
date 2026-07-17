export function buildSupabaseArgs(
  args: string[],
  env: Record<string, string | undefined> = process.env,
): string[] {
  if (env.MOMI_SUPABASE_CLI_DEBUG !== "1" || args.includes("--debug")) {
    return [...args]
  }
  return [...args, "--debug"]
}
