import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { databaseObjectAuthorityDiagnostic } from
  "./database_object_authority_diagnostic.ts"
import type {
  DatabaseObjectAuthority,
  DatabaseObjectAuthorityDiagnostic,
} from "./database_object_authority_types.ts"
import { sortDatabaseObjectAuthorityDiagnostics } from
  "./sort_database_object_authority_diagnostics.ts"

export function findDatabaseObjectAuthorityRatchetDiagnostics(
  base: DatabaseObjectAuthority,
  candidate: DatabaseObjectAuthority,
): DatabaseObjectAuthorityDiagnostic[] {
  const broad = (authority: DatabaseObjectAuthority) => new Map(
    authority.runtime_compatibility.filter((item) =>
      item.scope.kind === "historical_broad_migration_debt").map((item) => [
        canonicalJson([item.service, item.source_mode,
          item.scope.kind === "historical_broad_migration_debt"
            ? item.scope.schema : ""]), item,
      ]),
  )
  const exact = new Set(base.runtime_compatibility.filter((item) =>
    item.scope.kind === "exact_object").map((item) => {
      const object = item.scope.kind === "exact_object" ? item.scope.object : undefined
      return canonicalJson([item.service, item.source_mode, object?.schema ?? ""])
    }))
  const baseBroad = broad(base)
  const candidateBroad = broad(candidate)
  const diagnostics: DatabaseObjectAuthorityDiagnostic[] = []
  for (const [key, item] of candidateBroad) {
    if (baseBroad.has(key) || item.scope.kind !==
      "historical_broad_migration_debt") continue
    const schema = item.scope.schema
    const worsened = item.source_mode === "database.write" && baseBroad.has(
      canonicalJson([item.service, "database.read", schema]),
    )
    const widened = exact.has(canonicalJson([
      item.service, item.source_mode, schema,
    ]))
    diagnostics.push(databaseObjectAuthorityDiagnostic({
      subject: item.service, layer: "runtime_compatibility",
      source_path: item.source_path, json_pointer: item.json_pointer,
      code: worsened ? "broad_declaration_worsened" : widened
        ? "broad_declaration_widened" : "broad_declaration_added",
      object_class: "", canonical_identity: schema, mode: item.source_mode,
    }))
  }
  return sortDatabaseObjectAuthorityDiagnostics(diagnostics)
}
