import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { readJson } from "../architecture/read_json.ts"
import { validateJson } from "../architecture/validate_json.ts"
import type { DebtLifecycleRegistry } from "./debt_lifecycle_types.ts"

export async function loadDebtLifecycleRegistry(): Promise<DebtLifecycleRegistry> {
  const registry = await readJson<DebtLifecycleRegistry>(join(
    workspaceRoot,
    "docs",
    "debt-lifecycle-registry.json",
  ))
  const schema = await readJson<object>(join(
    workspaceRoot,
    "schemas",
    "debt-lifecycle-registry-v1.schema.json",
  ))
  validateJson(schema, registry, "docs/debt-lifecycle-registry.json")
  return registry
}
