const requiredSettings = [
  "SUPABASE_DB_URL",
  "MOMI_MODEL_EXECUTION_GATEWAY_URL",
  "MOMI_MODEL_GATEWAY_EVALUATION_SECRET",
] as const

export function isEvaluatorConfigured(
  readValue: (key: string) => string | undefined = Deno.env.get,
): boolean {
  return requiredSettings.every((key) => Boolean(readValue(key)?.trim()))
}
