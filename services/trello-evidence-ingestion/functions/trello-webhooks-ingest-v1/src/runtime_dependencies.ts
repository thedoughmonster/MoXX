import { sql } from "./database.ts"
import { storeRawEvidence } from "./store_raw_evidence.ts"
import type { IngestionDependencies } from "./types.ts"

export const ingestionDependencies: IngestionDependencies = {
  getSetting(name) {
    return Deno.env.get(name)
  },
  store(envelope) {
    return storeRawEvidence(sql, envelope)
  },
}
