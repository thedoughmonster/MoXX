import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import { databaseObjectAuthorityDiagnostic } from
  "./database_object_authority_diagnostic.ts"
import type {
  DatabaseObjectAuthorityDiagnostic,
  DatabaseObjectAuthorityRevision,
  DatabaseObjectCatalog,
  DatabaseObjectIdentity,
  PublicDatabaseMapping,
} from "./database_object_authority_types.ts"

export function buildDatabasePublicMappings(
  source: DatabaseObjectAuthorityRevision,
  catalog: DatabaseObjectCatalog,
): { public_mappings: PublicDatabaseMapping[];
  diagnostics: DatabaseObjectAuthorityDiagnostic[] } {
  const values: PublicDatabaseMapping[] = []
  const diagnostics: DatabaseObjectAuthorityDiagnostic[] = []
  for (const manifest of source.manifests) {
    const dataset = manifest.value.owned_dataset
    if (!dataset) continue
    const groups = [
      ["public_relation_reads", dataset.public_relation_reads ?? []],
      ["public_routine_reads", dataset.public_routine_reads ?? []],
      ["public_routine_commands", dataset.public_routine_commands ?? []],
      ["dynamic_read_routines", dataset.dynamic_read_routines ?? []],
    ] as const
    for (const [kind, mappings] of groups) for (const [index, mapping] of
      mappings.entries()) {
      const qualified = "relation" in mapping ? mapping.relation : mapping.routine
      const pointer = `/owned_dataset/${kind}/${index}`
      const matches: DatabaseObjectIdentity[] = []
      if (kind === "public_relation_reads") {
        const [schema, name] = qualified.split(".")
        if (catalog.relations.has(qualified) && schema && name) {
          matches.push({ class: "relation", schema, name })
        }
      } else matches.push(...(catalog.routines.get(qualified) ?? []))
      const code = matches.length === 0 ? "unknown_object" :
        matches.length > 1 ? "ambiguous_object_identity" : undefined
      if (code) {
        diagnostics.push(databaseObjectAuthorityDiagnostic({
          subject: manifest.value.service_key, layer: "public_mapping",
          source_path: manifest.path, json_pointer: pointer, code,
          object_class: kind === "public_relation_reads" ? "relation" : "routine",
          canonical_identity: qualified, mode: "",
        }))
        continue
      }
      const dynamic = "consumer_service" in mapping ? {
        consumer_service: mapping.consumer_service, role: mapping.role,
        allowed_schema: mapping.schema,
      } : {}
      values.push({ provider_service: manifest.value.service_key,
        contract: mapping.contract, mapping_kind: kind, object: matches[0]!,
        capability: kind === "public_relation_reads"
          ? "relation.read" : "routine.call",
        source_path: manifest.path, json_pointer: pointer, ...dynamic })
    }
  }
  return { public_mappings: values.sort((left, right) =>
    compareUtf16(canonicalJson(left), canonicalJson(right))), diagnostics }
}
