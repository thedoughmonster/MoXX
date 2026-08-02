import { isAbsolute, join, resolve } from "node:path"
import {
  FAST_SQL_FILENAME,
  RESOURCE_SQL_FILENAME,
  SQL_ARTIFACT_DIRECTORY,
} from "./sql_artifact_constants.ts"
import type { QueryCommand } from "./sql_artifact_types.ts"

export function buildSupabaseQueryCommand(
  repositoryRoot: string,
  sealedFile: string,
): QueryCommand {
  if (!isAbsolute(repositoryRoot) || resolve(repositoryRoot) !== repositoryRoot ||
    !isAbsolute(sealedFile)) {
    throw new Error("Supabase query paths must be absolute and canonical")
  }
  const allowed = [FAST_SQL_FILENAME, RESOURCE_SQL_FILENAME].map((name) =>
    join(repositoryRoot, SQL_ARTIFACT_DIRECTORY, name)
  )
  if (!allowed.includes(sealedFile as typeof allowed[number]) || sealedFile.includes("\0")) {
    throw new Error("Supabase query file is not a recognized sealed artifact")
  }
  return {
    executableName: "pnpm",
    arguments: [
      "exec", "supabase", "db", "query", "--linked", "--file", sealedFile,
      "--workdir", repositoryRoot, "--output-format", "json",
    ],
  }
}
