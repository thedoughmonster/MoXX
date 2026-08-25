import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type { DatabaseObjectIdentity } from
  "./database_object_authority_types.ts"

export function databaseObjectIdentityKey(identity: DatabaseObjectIdentity): string {
  return canonicalJson(identity)
}
