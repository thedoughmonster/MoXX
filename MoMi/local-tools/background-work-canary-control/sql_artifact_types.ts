export type SqlArtifactKind = "fast" | "resource"

export type VerifiedSqlArtifact = {
  kind: SqlArtifactKind
  path: string
  sha256: string
}

export type QueryCommand = {
  arguments: readonly string[]
}
