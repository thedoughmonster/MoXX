export function assertSupabaseDbPassword(
  env: Record<string, string | undefined> = process.env,
): string {
  const password = env.SUPABASE_DB_PASSWORD
  if (!password) {
    throw new Error(
      "SUPABASE_DB_PASSWORD is required for password-authenticated migrations",
    )
  }
  return password
}
