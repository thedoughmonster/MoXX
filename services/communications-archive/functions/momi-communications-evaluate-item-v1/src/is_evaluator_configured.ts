const requiredSettings = [
  "SUPABASE_DB_URL",
  "OPENAI_API_KEY",
  "MOMI_COMMUNICATIONS_EVALUATOR_MODEL",
] as const

export function isEvaluatorConfigured(
  readValue: (key: string) => string | undefined = Deno.env.get,
): boolean {
  return requiredSettings.every((key) => Boolean(readValue(key)?.trim()))
}
