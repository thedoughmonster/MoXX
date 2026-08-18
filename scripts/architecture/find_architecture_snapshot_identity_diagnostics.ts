import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { digestArchitectureSnapshotIdentity } from
  "./digest_architecture_snapshot_identity.ts"
import type {
  ArchitectureSnapshot,
  ArchitectureSnapshotDiagnostic,
  ArchitectureSnapshotIdentity,
} from "./architecture_snapshot_identity_types.ts"

export function findArchitectureSnapshotIdentityDiagnostics(
  expected: unknown,
  actual: ArchitectureSnapshot,
): ArchitectureSnapshotDiagnostic[] {
  const record = expected && typeof expected === "object"
    ? expected as Record<string, unknown>
    : {}
  const identity = record.identity && typeof record.identity === "object"
    ? record.identity as Record<string, unknown>
    : {}
  const service = identity.service_manifest_schema &&
      typeof identity.service_manifest_schema === "object"
    ? identity.service_manifest_schema as Record<string, unknown>
    : {}
  const fn = identity.function_manifest_schema &&
      typeof identity.function_manifest_schema === "object"
    ? identity.function_manifest_schema as Record<string, unknown>
    : {}
  const diagnostics: ArchitectureSnapshotDiagnostic[] = []
  const fields: Array<[string, unknown, unknown]> = [
    ["/$schema", identity.$schema, actual.identity.$schema],
    ["/schema_version", identity.schema_version, actual.identity.schema_version],
    ["/repository", identity.repository, actual.identity.repository],
    ["/branch", identity.branch, actual.identity.branch],
    ["/commit", identity.commit, actual.identity.commit],
    ["/service_manifest_schema/id", service.id,
      actual.identity.service_manifest_schema.id],
    ["/service_manifest_schema/version", service.version,
      actual.identity.service_manifest_schema.version],
    ["/function_manifest_schema/id", fn.id,
      actual.identity.function_manifest_schema.id],
    ["/function_manifest_schema/version", fn.version,
      actual.identity.function_manifest_schema.version],
    ["/architecture_contract_version", identity.architecture_contract_version,
      actual.identity.architecture_contract_version],
  ]
  for (const [field_path, expectedValue, actualValue] of fields) {
    if (canonicalJson(expectedValue) !== canonicalJson(actualValue)) {
      diagnostics.push({
        code: "identity_mismatch", field_path,
        expected: expectedValue, actual: actualValue,
      })
    }
  }
  const expectedDigest = digestArchitectureSnapshotIdentity(
    identity as unknown as ArchitectureSnapshotIdentity,
  )
  if (record.digest !== expectedDigest) diagnostics.push({
    code: "digest_mismatch", field_path: "/digest",
    expected: expectedDigest, actual: record.digest,
  })
  const actualDigest = digestArchitectureSnapshotIdentity(actual.identity)
  if (actual.digest !== actualDigest) diagnostics.push({
    code: "digest_mismatch", field_path: "/actual/digest",
    expected: actualDigest, actual: actual.digest,
  })
  if (record.digest !== actual.digest) diagnostics.push({
    code: "digest_mismatch", field_path: "/digest",
    expected: record.digest, actual: actual.digest,
  })
  return diagnostics.sort((left, right) => canonicalJson([
    left.field_path, left.code, left.expected, left.actual,
  ]).localeCompare(canonicalJson([
    right.field_path, right.code, right.expected, right.actual,
  ])))
}
