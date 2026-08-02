import { createHash } from "node:crypto"
import { realpathSync } from "node:fs"
import { isAbsolute, join, resolve } from "node:path"
import { readBoundedRegularFile } from "./read_bounded_regular_file.ts"
import {
  FAST_SQL_FILENAME,
  RESOURCE_SQL_FILENAME,
  SQL_ARTIFACT_DIRECTORY,
  SQL_ARTIFACT_SHA256,
} from "./sql_artifact_constants.ts"
import type { SqlArtifactKind, VerifiedSqlArtifact } from "./sql_artifact_types.ts"

export function verifySqlArtifact(
  repositoryRoot: string,
  kind: SqlArtifactKind,
): VerifiedSqlArtifact {
  if (!isAbsolute(repositoryRoot) || resolve(repositoryRoot) !== repositoryRoot ||
    realpathSync(repositoryRoot) !== repositoryRoot) {
    throw new Error("SQL artifact repository root is invalid")
  }
  const filename = kind === "fast" ? FAST_SQL_FILENAME : RESOURCE_SQL_FILENAME
  const artifactPath = join(repositoryRoot, SQL_ARTIFACT_DIRECTORY, filename)
  if (realpathSync(artifactPath) !== artifactPath) {
    throw new Error("Sealed SQL artifact path is not canonical")
  }
  const sql = readBoundedRegularFile(artifactPath, 128 * 1024)
  const sha256 = createHash("sha256").update(sql, "utf8").digest("hex")
  if (sha256 !== SQL_ARTIFACT_SHA256[kind]) {
    throw new Error("Sealed SQL artifact digest mismatch")
  }
  return { kind, path: artifactPath, sha256 }
}
