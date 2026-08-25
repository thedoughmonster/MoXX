import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import type { DatabaseObjectAuthorityDiagnostic } from
  "./database_object_authority_types.ts"

export function sortDatabaseObjectAuthorityDiagnostics(
  values: DatabaseObjectAuthorityDiagnostic[],
): DatabaseObjectAuthorityDiagnostic[] {
  const tuple = (value: DatabaseObjectAuthorityDiagnostic) => [
    value.subject, value.layer, value.source_path, value.json_pointer,
    value.code, value.object_class, value.canonical_identity, value.mode,
  ]
  return [...values].sort((left, right) =>
    compareUtf16(canonicalJson(tuple(left)), canonicalJson(tuple(right))))
}
