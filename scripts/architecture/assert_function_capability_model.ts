import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { assertArchitectureSnapshotIdentity } from
  "./assert_architecture_snapshot_identity.ts"
import type { ArchitectureSnapshot } from
  "./architecture_snapshot_identity_types.ts"
import { functionCapabilityModelSchemaPath } from "./paths.ts"
import { provideFunctionCapabilityModel } from
  "./provide_function_capability_model.ts"
import { readJson } from "./read_json.ts"
import { validateArchitecture } from "./validate_architecture.ts"
import { validateJson } from "./validate_json.ts"

export async function assertFunctionCapabilityModel(
  expected: unknown,
): Promise<void> {
  const record = expected && typeof expected === "object" &&
      !Array.isArray(expected)
    ? expected as Record<string, unknown> : {}
  const failures: string[] = []
  const schema = await readJson<object>(functionCapabilityModelSchemaPath)
  try {
    validateJson(schema, expected, "function capability model")
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error))
  }
  let snapshotValid = true
  try {
    await assertArchitectureSnapshotIdentity(record.source_snapshot)
  } catch (error) {
    snapshotValid = false
    failures.push(error instanceof Error ? error.message : String(error))
  }
  if (snapshotValid) {
    const source = record.source_snapshot as ArchitectureSnapshot
    const actual = await provideFunctionCapabilityModel(
      await validateArchitecture(), source, source,
    )
    if (!actual.projection) failures.push(canonicalJson(actual.diagnostics))
    else if (canonicalJson(expected) !== canonicalJson(actual.projection)) {
      failures.push(`projection mismatch: ${canonicalJson(actual.projection)}`)
    }
  }
  if (failures.length > 0) {
    throw new Error(`function capability model mismatch: ${failures.join("; ")}`)
  }
}
