import postgres from "postgres"

const connectionString = Deno.env.get("SUPABASE_DB_URL")

if (!connectionString) {
  throw new Error("SUPABASE_DB_URL is not configured")
}

export const sql = postgres(connectionString, {
  max: 1,
  prepare: false,
})
