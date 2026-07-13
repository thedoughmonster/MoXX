export function requireCredentials(database: boolean): void {
  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required")
  }
  if (database && !process.env.SUPABASE_DB_PASSWORD) {
    throw new Error("SUPABASE_DB_PASSWORD is required for migration checks")
  }
}
