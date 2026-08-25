import postgres from "postgres"

let client: ReturnType<typeof postgres> | null = null

export function getDatabase(): ReturnType<typeof postgres> {
  if (client) return client
  const connectionString = Deno.env.get("SUPABASE_DB_URL")
  if (!connectionString) throw new Error("archive database unavailable")
  client = postgres(connectionString, { idle_timeout: 2, max: 1,
    max_lifetime: 60, prepare: false })
  return client
}
