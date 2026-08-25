import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { workspaceRoot } from "./architecture/paths.ts"
import { renderFunctionCatalog } from "./function_catalog.ts"

const architecture = await validateArchitecture()
const catalogPath = join(workspaceRoot, "docs", "service-catalog.md")
await writeFile(
  catalogPath,
  renderFunctionCatalog(architecture.functions),
  "utf8",
)
