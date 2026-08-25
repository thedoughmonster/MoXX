import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { digestArchitectureSnapshotIdentity } from
  "./digest_architecture_snapshot_identity.ts"
import type {
  FunctionCapabilityDiagnostic,
} from "./function_capability_model_types.ts"
import { architectureSnapshotIdentitySchemaPath } from "./paths.ts"
import { readJson } from "./read_json.ts"
import { sortFunctionCapabilityDiagnostics } from
  "./sort_function_capability_diagnostics.ts"
import type { ArchitectureSnapshot } from
  "./architecture_snapshot_identity_types.ts"
import { validateJson } from "./validate_json.ts"

export async function findFunctionCapabilitySourceDiagnostics(
  candidate: ArchitectureSnapshot,
  expected: ArchitectureSnapshot,
): Promise<FunctionCapabilityDiagnostic[]> {
  const diagnostics: FunctionCapabilityDiagnostic[] = []
  const schema = await readJson<object>(architectureSnapshotIdentitySchemaPath)
  for (const [name, snapshot] of [
    ["candidate", candidate], ["expected", expected],
  ] as const) {
    let actual = "valid"
    try {
      validateJson(schema, snapshot.identity, `${name} source snapshot`)
    } catch (error) {
      actual = error instanceof Error ? error.message : String(error)
    }
    const complete = snapshot && typeof snapshot === "object" &&
      canonicalJson(Object.keys(snapshot).sort()) ===
        canonicalJson(["digest", "identity"]) &&
      snapshot.identity?.architecture_contract_version === 2 &&
      snapshot.digest ===
        digestArchitectureSnapshotIdentity(snapshot.identity)
    if (actual !== "valid" || !complete) diagnostics.push({
      function_key: "<repository>",
      field_path: `/source_snapshot/${name}`,
      code: "source_snapshot_stale",
      target: actual === "valid" ? canonicalJson(snapshot) : actual,
      provenance: ["architecture-snapshot-identity/v1", name],
    })
  }
  if (diagnostics.length === 0 &&
    canonicalJson(candidate) !== canonicalJson(expected)) diagnostics.push({
      function_key: "<repository>",
      field_path: "/source_snapshot",
      code: "source_snapshot_stale",
      target: canonicalJson(candidate),
      provenance: [expected.digest, candidate.digest],
    })
  return sortFunctionCapabilityDiagnostics(diagnostics)
}
