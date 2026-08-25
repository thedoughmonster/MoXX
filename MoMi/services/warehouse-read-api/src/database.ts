import postgres from "postgres"

const connectionString = Deno.env.get("SUPABASE_DB_URL")
if (!connectionString) throw new Error("SUPABASE_DB_URL is not configured")

export const sql = postgres(connectionString, {
  idle_timeout: 2,
  max: 1,
  max_lifetime: 60,
  prepare: false,
})
