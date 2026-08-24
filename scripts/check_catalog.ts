import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { workspaceRoot } from "./architecture/paths.ts"
import { renderFunctionCatalog } from "./function_catalog.ts"
import { catalogDiagnostic } from "./diagnostics/catalog_diagnostic.ts"
import { renderRepositoryDiagnostics } from
  "./diagnostics/render_repository_diagnostics.ts"
import { validateArchitectureWithDiagnostics } from
  "./diagnostics/validate_architecture_with_diagnostics.ts"

const architecture = await validateArchitectureWithDiagnostics()
const expected = renderFunctionCatalog(
  architecture.functions,
  architecture.services,
)
const actual = await readFile(join(workspaceRoot, "docs", "service-catalog.md"), "utf8")

if (actual !== expected) {
  throw new Error(
    `Service catalog violations:\n${renderRepositoryDiagnostics([
      catalogDiagnostic("hard_stop"),
    ]).trimEnd()}`,
  )
}

console.log("Service catalog is current.")
