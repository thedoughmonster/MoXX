export function migrationDatabaseUrl(
  poolerUrl: string,
  projectRef: string,
): string {
  const url = new URL(poolerUrl)
  const approvedHost = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)
  if (url.protocol !== "postgresql:" || !approvedHost) {
    throw new Error("Migration target must use the approved Supabase pooler domain")
  }
  const authority = poolerUrl.match(/^postgresql:\/\/([^@/]*)@/)?.[1]
  if (url.username !== `postgres.${projectRef}` || url.password || authority?.includes(":")) {
    throw new Error("Migration target must use the expected password-free project user")
  }
  if (url.port !== "5432" || url.pathname !== "/postgres") {
    throw new Error("Migration target must use the IPv4 session pooler database")
  }
  if (url.search || url.hash) {
    throw new Error("Migration target must not contain query or fragment data")
  }
  return `${url.toString()}?options=-c%20jit%3Don`
}
