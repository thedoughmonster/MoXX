import { join } from "node:path"

import { readJson } from "../architecture/read_json.ts"
import { validateJson } from "../architecture/validate_json.ts"
import { workspaceRoot } from "../architecture/paths.ts"
import type { ConstitutionBaseline } from "./types.ts"

export async function loadConstitutionBaseline(): Promise<ConstitutionBaseline> {
  const path = join(workspaceRoot, "docs", "service-constitution-debt-baseline.json")
  const schemaPath = join(
    workspaceRoot,
    "schemas",
    "service-constitution-debt-baseline-v1.schema.json",
  )
  const baseline = await readJson<ConstitutionBaseline>(path)
  const schema = await readJson<object>(schemaPath)
  validateJson(schema, baseline, "docs/service-constitution-debt-baseline.json")
  return baseline
}
