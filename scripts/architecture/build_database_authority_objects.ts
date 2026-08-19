import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import { databaseObjectAuthorityDiagnostic } from
  "./database_object_authority_diagnostic.ts"
import { databaseObjectIdentityKey } from "./database_object_identity_key.ts"
import type {
  DatabaseAuthorityObject,
  DatabaseObjectAuthorityDiagnostic,
  DatabaseObjectAuthorityRevision,
  DatabaseObjectCatalog,
} from "./database_object_authority_types.ts"

export function buildDatabaseAuthorityObjects(
  source: DatabaseObjectAuthorityRevision,
  catalog: DatabaseObjectCatalog,
): { objects: DatabaseAuthorityObject[];
  diagnostics: DatabaseObjectAuthorityDiagnostic[] } {
  const objects: DatabaseAuthorityObject[] = []
  const diagnostics: DatabaseObjectAuthorityDiagnostic[] = []
  for (const manifest of source.manifests) {
    const dataset = manifest.value.owned_dataset
    if (!dataset) continue
    for (const [index, qualified] of dataset.private_relations.entries()) {
      const path = `/owned_dataset/private_relations/${index}`
      const [schema, name] = qualified.split(".")
      const relationKind = catalog.relations.get(qualified)
      if (!schema || !name || !relationKind) {
        diagnostics.push(databaseObjectAuthorityDiagnostic({
          subject: manifest.value.service_key, layer: "target_ownership",
          source_path: manifest.path, json_pointer: path,
          code: "unknown_object", object_class: "relation",
          canonical_identity: qualified, mode: "",
        }))
        continue
      }
      objects.push({ identity: { class: "relation", schema, name },
        owner_service: manifest.value.service_key, relation_kind: relationKind,
        source_path: manifest.path, json_pointer: path,
        replay_identity: qualified })
    }
    for (const [index, qualified] of (dataset.private_routines ?? []).entries()) {
      const path = `/owned_dataset/private_routines/${index}`
      const matches = catalog.routines.get(qualified) ?? []
      if (matches.length === 0) diagnostics.push(databaseObjectAuthorityDiagnostic({
        subject: manifest.value.service_key, layer: "target_ownership",
        source_path: manifest.path, json_pointer: path, code: "unknown_object",
        object_class: "routine", canonical_identity: qualified, mode: "",
      }))
      for (const identity of matches) objects.push({ identity,
        owner_service: manifest.value.service_key, source_path: manifest.path,
        json_pointer: path, replay_identity: `${identity.schema}.${identity.name}(` +
          `${identity.arguments.join(",")})` })
    }
  }
  const byIdentity = new Map<string, DatabaseAuthorityObject[]>()
  for (const object of objects) byIdentity.set(databaseObjectIdentityKey(object.identity),
    [...(byIdentity.get(databaseObjectIdentityKey(object.identity)) ?? []), object])
  for (const [identity, matches] of byIdentity) {
    const owners = new Set(matches.map((item) => item.owner_service))
    if (owners.size > 1) diagnostics.push(databaseObjectAuthorityDiagnostic({
      subject: [...owners].sort(compareUtf16).join(","), layer: "target_ownership",
      code: "target_owner_ambiguous", object_class: matches[0]!.identity.class,
      canonical_identity: identity, mode: "",
    }))
  }
  const physical = new Map<string, Set<string>>()
  for (const object of objects) {
    const identity = object.identity
    const key = `${identity.schema}.${identity.name}`
    physical.set(key, new Set([...(physical.get(key) ?? []), identity.class]))
  }
  for (const [identity, classes] of physical) if (classes.size > 1) {
    diagnostics.push(databaseObjectAuthorityDiagnostic({
      subject: identity, layer: "target_ownership", code: "conflicting_authority",
      object_class: [...classes].sort(compareUtf16).join(","),
      canonical_identity: identity, mode: "",
    }))
  }
  return { objects: objects.sort((left, right) =>
    compareUtf16(canonicalJson(left), canonicalJson(right))), diagnostics }
}
