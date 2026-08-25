import { createHash } from "node:crypto"

import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type { DatabaseObjectAuthority } from
  "./database_object_authority_types.ts"

export function digestDatabaseObjectAuthority(
  authority: Omit<DatabaseObjectAuthority, "authority_digest"> |
    DatabaseObjectAuthority,
): string {
  const { $schema: _schema, authority_digest: _digest, ...payload } =
    authority as DatabaseObjectAuthority
  return createHash("sha256").update(canonicalJson(payload)).digest("hex")
}
