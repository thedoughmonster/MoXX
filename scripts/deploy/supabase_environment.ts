export function supabaseEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const environment = {
    ...source,
    SUPABASE_PROFILE: "supabase",
    SUPABASE_TELEMETRY_DISABLED: "1",
  }
  delete environment.SUPABASE_DB_PASSWORD
  delete environment.PGPASSWORD
  return environment
}
