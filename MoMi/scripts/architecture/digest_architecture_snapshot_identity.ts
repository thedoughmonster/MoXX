import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { hashText } from "../dev_loop/hash_text.ts"
import type { ArchitectureSnapshotIdentity } from
  "./architecture_snapshot_identity_types.ts"

export function digestArchitectureSnapshotIdentity(
  identity: ArchitectureSnapshotIdentity,
): string {
  return hashText(canonicalJson(identity))
}
