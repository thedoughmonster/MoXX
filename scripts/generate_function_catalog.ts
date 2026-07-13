import { readdir, readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

import {
  renderFunctionCatalog,
  type FunctionManifest,
} from "./function_catalog.ts"

const root = fileURLToPath(new URL("../", import.meta.url))
const functionsRoot = join(root, "supabase", "functions")
const catalogPath = join(root, "docs", "service-catalog.md")
const entries = await readdir(functionsRoot, { withFileTypes: true })
const manifests: FunctionManifest[] = []

for (const entry of entries) {
  if (!entry.isDirectory()) {
    continue
  }

  const source = await readFile(
    join(functionsRoot, entry.name, "function.json"),
    "utf8",
  )
  manifests.push(JSON.parse(source) as FunctionManifest)
}

await writeFile(catalogPath, renderFunctionCatalog(manifests), "utf8")
