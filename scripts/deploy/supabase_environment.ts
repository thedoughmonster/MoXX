export function supabaseEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const environment = { ...source }

  if (environment.SUPABASE_DB_PASSWORD) {
    environment.PGPASSWORD = environment.SUPABASE_DB_PASSWORD
  }

  return environment
}
