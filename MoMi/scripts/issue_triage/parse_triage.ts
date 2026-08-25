import type { IssueTriage } from "./types.ts"
import { validateTriage } from "./validate_triage.ts"

export function parseTriage(source: string): IssueTriage {
  return validateTriage(JSON.parse(source))
}
