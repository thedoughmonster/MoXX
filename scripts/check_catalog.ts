import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { workspaceRoot } from "./architecture/paths.ts"
import { renderFunctionCatalog } from "./function_catalog.ts"

const architecture = await validateArchitecture()
const expected = renderFunctionCatalog(architecture.functions)
const actual = await readFile(join(workspaceRoot, "docs", "service-catalog.md"), "utf8")

if (actual !== expected) {
  throw new Error("docs/service-catalog.md is stale; run catalog:generate")
}

console.log("Service catalog is current.")
