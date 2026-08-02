import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { readBoundedRegularFile } from "./read_bounded_regular_file.ts"
import {
  FAST_SQL_FILENAME,
  RESOURCE_SQL_FILENAME,
  SQL_ARTIFACT_SHA256,
} from "./sql_artifact_constants.ts"
import type { SqlArtifactKind } from "./sql_artifact_types.ts"
import { sha256Text } from "./sha256_text.ts"

export function loadCombinedSampleArtifact(kind: SqlArtifactKind): string {
  const filename = kind === "fast" ? FAST_SQL_FILENAME : RESOURCE_SQL_FILENAME
  const path = fileURLToPath(new URL(`./sql/${filename}`, import.meta.url))
  if (realpathSync(path) !== path) throw new Error("Combined sample SQL path is not canonical")
  const sql = readBoundedRegularFile(path, 128 * 1024)
  if (sha256Text(sql) !== SQL_ARTIFACT_SHA256[kind] || !sql.endsWith(";\n")) {
    throw new Error("Combined sample SQL artifact is not sealed")
  }
  const sourceClock = "sample_clock as (\n  select clock_timestamp() as observed_at\n)"
  const combinedClock = "sample_clock as (\n  select observed_at from heartbeat_clock\n)"
  if (sql.split(sourceClock).length !== 2) {
    throw new Error("Combined sample SQL clock contract drifted")
  }
  return sql.replace(sourceClock, combinedClock).slice(0, -2)
}
