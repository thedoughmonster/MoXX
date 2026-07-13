import { readFileSync } from "node:fs"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"

const poolerUrlPath = join(workspaceRoot, "supabase", ".temp", "pooler-url")

export function migrationDatabaseUrl(
  source: NodeJS.ProcessEnv = process.env,
  poolerUrl = readFileSync(poolerUrlPath, "utf8").trim(),
): string {
  const url = new URL(poolerUrl)
  const parameters = new URLSearchParams({ sslmode: "require" })
  const usesPat = Boolean(source.SUPABASE_ACCESS_TOKEN)
    && source.SUPABASE_DB_PASSWORD === source.SUPABASE_ACCESS_TOKEN

  if (usesPat) {
    parameters.set("options", "-c jit=on")
  }
  url.search = parameters.toString().replaceAll("+", "%20")

  return url.toString()
}
