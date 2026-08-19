import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type { DatabaseObjectAuthority } from
  "./database_object_authority_types.ts"

export function renderDatabaseObjectAuthority(
  authority: DatabaseObjectAuthority,
): string {
  return `${canonicalJson(authority)}\n`
}
