import { CHILD_ENVIRONMENT_KEYS } from "./constants.ts"

export function buildChildEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const child: NodeJS.ProcessEnv = {}
  for (const key of CHILD_ENVIRONMENT_KEYS) {
    const value = source[key]
    if (value) child[key] = value
  }
  child.SUPABASE_TELEMETRY_DISABLED = "1"
  return child
}
