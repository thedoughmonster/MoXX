import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { readJson } from "../architecture/read_json.ts"
import type { ConstitutionBaseline } from "./types.ts"
import { validateJson } from "../architecture/validate_json.ts"

export async function loadAccessBaseline(): Promise<ConstitutionBaseline> {
  const baseline = await readJson<ConstitutionBaseline>(join(
    workspaceRoot,
    "docs",
    "service-access-debt-baseline.json",
  ))
  const schema = await readJson<object>(join(
    workspaceRoot,
    "schemas",
    "service-access-debt-baseline-v1.schema.json",
  ))
  validateJson(schema, baseline, "docs/service-access-debt-baseline.json")
  return baseline
}
