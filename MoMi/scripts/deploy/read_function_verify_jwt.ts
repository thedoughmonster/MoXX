import { readFileSync } from "node:fs"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { parseFunctionVerifyJwt } from "./parse_function_verify_jwt.ts"

export function readFunctionVerifyJwt(): ReadonlyMap<string, boolean> {
  const path = join(workspaceRoot, "supabase", "config.toml")
  return parseFunctionVerifyJwt(readFileSync(path, "utf8"))
}
