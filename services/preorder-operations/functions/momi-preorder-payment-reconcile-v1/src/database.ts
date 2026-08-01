import postgres from "postgres"

let database: ReturnType<typeof postgres> | null = null

export function getDatabase(): ReturnType<typeof postgres> {
  if (database) return database
  const url = Deno.env.get("SUPABASE_DB_URL")
  if (!url) throw new Error("SUPABASE_DB_URL is required")
  database = postgres(url, {
    max: 1, idle_timeout: 5, connect_timeout: 5, prepare: false,
  })
  return database
}
