export function assertDatabaseTarget(databaseUrl: string, projectRef: string): void {
  const target = new URL(databaseUrl)
  const direct = target.hostname === `db.${projectRef}.supabase.co` &&
    target.username === "postgres"
  const pooler = target.hostname.endsWith(".pooler.supabase.com") &&
    target.username === `postgres.${projectRef}`
  if (!["postgres:", "postgresql:"].includes(target.protocol) ||
      (!direct && !pooler) || target.pathname !== "/postgres") {
    throw new Error("Database identity does not match the selected Supabase project")
  }
}
