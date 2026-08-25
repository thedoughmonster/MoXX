import type { DatabaseObjectAuthorityDiagnostic } from
  "./database_object_authority_types.ts"

export function databaseObjectAuthorityDiagnostic(
  value: Partial<DatabaseObjectAuthorityDiagnostic> & { code: string },
): DatabaseObjectAuthorityDiagnostic {
  return {
    subject: value.subject ?? "",
    layer: value.layer ?? "",
    source_path: value.source_path ?? "",
    json_pointer: value.json_pointer ?? "",
    code: value.code,
    object_class: value.object_class ?? "",
    canonical_identity: value.canonical_identity ?? "",
    mode: value.mode ?? "",
  }
}
