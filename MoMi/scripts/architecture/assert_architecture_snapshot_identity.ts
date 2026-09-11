import { canonicalJson } from "../dev_loop/canonical_json.ts"
import {
  architectureSnapshotIdentitySchemaPath,
  workspaceRoot,
} from "./paths.ts"
import { buildArchitectureSnapshotIdentity } from
  "./build_architecture_snapshot_identity.ts"
import { findArchitectureSnapshotIdentityDiagnostics } from
  "./find_architecture_snapshot_identity_diagnostics.ts"
import { readJson } from "./read_json.ts"
import { validateJson } from "./validate_json.ts"
import {
  ArchitectureSnapshotSourceError,
  type ArchitectureSnapshotDiagnostic,
} from "./architecture_snapshot_identity_types.ts"

export async function assertArchitectureSnapshotIdentity(
  expected: unknown,
  root = workspaceRoot,
): Promise<void> {
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) {
    throw new Error("source_snapshot must be an object")
  }
  const record = expected as Record<string, unknown>
  const input: ArchitectureSnapshotDiagnostic[] = []
  if (canonicalJson(Object.keys(record).sort()) !==
    canonicalJson(["digest", "identity"])) input.push({
    code: "schema_invalid", field_path: "/",
    expected: ["digest", "identity"], actual: Object.keys(record).sort(),
  })
  if (typeof record.digest !== "string" || !/^[0-9a-f]{64}$/.test(record.digest)) {
    input.push({
      code: "schema_invalid", field_path: "/digest",
      expected: "lowercase SHA-256", actual: record.digest,
    })
  }
  let actual
  try {
    actual = await buildArchitectureSnapshotIdentity(root)
  } catch (error) {
    if (error instanceof ArchitectureSnapshotSourceError) {
      throw new Error(
        `source_snapshot mismatch: ${canonicalJson(error.diagnostics)}`,
      )
    }
    throw error
  }
  input.push(...findArchitectureSnapshotIdentityDiagnostics(record, actual))
  const schema = await readJson<object>(
    root === workspaceRoot
      ? architectureSnapshotIdentitySchemaPath
      : `${root}/schemas/architecture-snapshot-identity-v2.schema.json`,
  )
  try {
    validateJson(schema, record.identity, "source_snapshot.identity")
  } catch (error) {
    input.push({
      code: "schema_invalid", field_path: "/identity",
      expected: "Architecture Snapshot Identity v2",
      actual: error instanceof Error ? error.message : String(error),
    })
  }
  input.sort((a, b) => canonicalJson([
    a.field_path, a.code, a.expected, a.actual,
  ]).localeCompare(canonicalJson([
    b.field_path, b.code, b.expected, b.actual,
  ])))
  if (input.length > 0) {
    throw new Error(`source_snapshot mismatch: ${canonicalJson(input)}`)
  }
}
