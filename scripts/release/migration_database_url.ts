export function migrationDatabaseUrl(
  poolerUrl: string,
  projectRef: string,
): string {
  const url = new URL(poolerUrl)
  const validHost = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)
  if (url.protocol !== "postgresql:" || !validHost) {
    throw new Error("Migration target must use an approved Supabase pooler")
  }
  if (url.username !== `postgres.${projectRef}` || url.password) {
    throw new Error("Migration target must use the expected password-free project user")
  }
  if (url.port !== "5432" || url.pathname !== "/postgres") {
    throw new Error("Migration target must use the session pooler database")
  }
  if (url.search || url.hash) {
    throw new Error("Migration target must not contain unapproved URL options")
  }
  url.searchParams.set("sslmode", "verify-full")
  return url.toString()
}
