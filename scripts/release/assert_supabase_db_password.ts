export function assertSupabaseDbPassword(
  env: Record<string, string | undefined> = process.env,
): void {
  if (!env.SUPABASE_DB_PASSWORD) {
    throw new Error(
      "SUPABASE_DB_PASSWORD is required for password-authenticated migrations",
    )
  }
}
