import { readFile, stat } from "node:fs/promises"
import { join } from "node:path"

import { PINNED_SUPABASE_CLI_VERSION } from "./constants.ts"
export async function resolveSupabaseCli(workspaceRoot: string): Promise<string> {
  const packageRoot = join(workspaceRoot, "node_modules", "supabase")
  const metadata = JSON.parse(await readFile(
    join(packageRoot, "package.json"), "utf8",
  )) as { version?: string }
  if (metadata.version !== PINNED_SUPABASE_CLI_VERSION) {
    throw new Error("Repository Supabase CLI version does not match the pinned toolchain")
  }
  const cli = join(packageRoot, "dist", "supabase.js")
  if (!(await stat(cli)).isFile()) throw new Error("Pinned Supabase CLI is unavailable")
  return cli
}
