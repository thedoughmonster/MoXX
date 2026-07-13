const JIT_OPTION = "-c jit=on"

export function supabaseEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const environment = { ...source }
  const usesPat = Boolean(environment.SUPABASE_ACCESS_TOKEN)
    && environment.SUPABASE_DB_PASSWORD === environment.SUPABASE_ACCESS_TOKEN

  if (usesPat) {
    environment.PGOPTIONS = [environment.PGOPTIONS, JIT_OPTION]
      .filter(Boolean)
      .join(" ")
  }

  return environment
}
