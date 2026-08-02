import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { readBoundedRegularFile } from "./read_bounded_regular_file.ts"
import { FAST_SQL_FILENAME, RESOURCE_SQL_FILENAME,
  SQL_ARTIFACT_SHA256 } from "./sql_artifact_constants.ts"
import type { SqlArtifactKind } from "./sql_artifact_types.ts"
import { sha256Text } from "./sha256_text.ts"

export function loadSealedSampleArtifact(kind: SqlArtifactKind): string {
  const filename = kind === "fast" ? FAST_SQL_FILENAME : RESOURCE_SQL_FILENAME
  const path = fileURLToPath(new URL(`./sql/${filename}`, import.meta.url))
  if (realpathSync(path) !== path) throw new Error("Sample SQL path is not canonical")
  const sql = readBoundedRegularFile(path, 128 * 1024)
  if (sha256Text(sql) !== SQL_ARTIFACT_SHA256[kind] || !sql.endsWith(";\n")) {
    throw new Error("Sample SQL artifact is not sealed")
  }
  return sql
}
