import { isAbsolute } from "node:path"

import { DEV_PROJECT_REF, PROD_PROJECT_REF } from "./constants.ts"
import type { CliOptions } from "./types.ts"

export function validateCli(options: CliOptions): void {
  if (options.environment === "prod" || options.projectRef === PROD_PROJECT_REF) {
    throw new Error("Production is prohibited for the legacy recipe importer")
  }
  if (options.environment !== "dev" || options.projectRef !== DEV_PROJECT_REF) {
    throw new Error(`Target must be --env dev --project-ref ${DEV_PROJECT_REF}`)
  }
  if (options.mode !== "import" && options.mode !== "verify") {
    throw new Error("--mode must be import or verify")
  }
  if (options.backend !== "supabase-cli" && options.backend !== "psql") {
    throw new Error("--backend must be supabase-cli or psql")
  }
  if (!isAbsolute(options.source)) throw new Error("--source must be absolute")
}
