import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import { databaseObjectAuthorityDiagnostic } from
  "./database_object_authority_diagnostic.ts"
import type {
  DatabaseObjectAuthorityDiagnostic,
  DatabaseObjectAuthorityRevision,
  DatabaseObjectCatalog,
  DatabaseObjectIdentity,
  RuntimeCompatibility,
} from "./database_object_authority_types.ts"

export function buildDatabaseRuntimeCompatibility(
  source: DatabaseObjectAuthorityRevision,
  catalog: DatabaseObjectCatalog,
): { runtime_compatibility: RuntimeCompatibility[];
  diagnostics: DatabaseObjectAuthorityDiagnostic[] } {
  const values: RuntimeCompatibility[] = []
  const diagnostics: DatabaseObjectAuthorityDiagnostic[] = []
  for (const manifest of source.manifests) for (const mode of
    ["read", "write"] as const) {
    const sourceMode = `database.${mode}` as const
    for (const [index, declaration] of manifest.value.database[mode].entries()) {
      const pointer = `/database/${mode}/${index}`
      if (!declaration.includes(".")) {
        values.push({ service: manifest.value.service_key, source_mode: sourceMode,
          source_path: manifest.path, json_pointer: pointer,
          scope: { kind: "historical_broad_migration_debt", schema: declaration } })
        continue
      }
      const matches: DatabaseObjectIdentity[] = []
      const relation = catalog.relations.get(declaration)
      const [schema, name] = declaration.split(".")
      if (relation && schema && name) matches.push({ class: "relation", schema, name })
      matches.push(...(catalog.routines.get(declaration) ?? []))
      const code = matches.length === 0 ? "unknown_object" :
        matches.length > 1 ? "ambiguous_object_identity" : undefined
      if (code) diagnostics.push(databaseObjectAuthorityDiagnostic({
        subject: manifest.value.service_key, layer: "runtime_compatibility",
        source_path: manifest.path, json_pointer: pointer, code,
        object_class: "", canonical_identity: declaration, mode: sourceMode,
      }))
      else values.push({ service: manifest.value.service_key, source_mode: sourceMode,
        source_path: manifest.path, json_pointer: pointer,
        scope: { kind: "exact_object", object: matches[0]! } })
    }
  }
  return { runtime_compatibility: values.sort((left, right) =>
    compareUtf16(canonicalJson(left), canonicalJson(right))), diagnostics }
}
