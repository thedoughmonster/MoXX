import { supabaseEnvironment } from "./supabase_environment.ts"

export function supabaseDatabaseEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const temporaryAccessToken = source.SUPABASE_DB_PASSWORD
  if (!temporaryAccessToken) {
    throw new Error(
      "SUPABASE_DB_PASSWORD must contain a temporary Supabase database access token",
    )
  }
  const environment = supabaseEnvironment(source)
  environment.SUPABASE_DB_PASSWORD = temporaryAccessToken
  environment.PGPASSWORD = temporaryAccessToken
  return environment
}
