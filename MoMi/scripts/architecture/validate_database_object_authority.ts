import Ajv2020 from "ajv/dist/2020.js"

import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import { databaseObjectAuthorityDiagnostic } from
  "./database_object_authority_diagnostic.ts"
import { databaseObjectIdentityKey } from "./database_object_identity_key.ts"
import type {
  DatabaseObjectAuthority,
  DatabaseObjectAuthorityDiagnostic,
} from "./database_object_authority_types.ts"
import { digestDatabaseObjectAuthority } from
  "./digest_database_object_authority.ts"
import { sortDatabaseObjectAuthorityDiagnostics } from
  "./sort_database_object_authority_diagnostics.ts"

export function validateDatabaseObjectAuthority(
  value: unknown,
  schema: object,
  expectedSourceDigest?: string,
): DatabaseObjectAuthorityDiagnostic[] {
  const raw = value as Partial<DatabaseObjectAuthority>
  const diagnostics: DatabaseObjectAuthorityDiagnostic[] = []
  if (raw?.schema_version !== "database-object-authority/v1") {
    return [databaseObjectAuthorityDiagnostic({
      subject: String(raw?.revision ?? ""), layer: "generated_model",
      code: "unknown_version", canonical_identity: String(raw?.schema_version),
    })]
  }
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)
  if (!validate(value)) {
    for (const error of validate.errors ?? []) diagnostics.push(
      databaseObjectAuthorityDiagnostic({ subject: raw.revision ?? "",
        layer: "generated_model", json_pointer: error.instancePath || "/",
        code: "schema_invalid", canonical_identity:
          `${error.keyword}:${error.message ?? "invalid"}` }),
    )
    return sortDatabaseObjectAuthorityDiagnostics(diagnostics)
  }
  const authority = value as DatabaseObjectAuthority
  if (expectedSourceDigest !== undefined &&
    authority.source_digest !== expectedSourceDigest) {
    diagnostics.push(databaseObjectAuthorityDiagnostic({
      subject: authority.revision, layer: "source_digest",
      json_pointer: "/source_digest", code: "source_digest_drift",
      canonical_identity: authority.source_digest,
    }))
  }
  if (authority.authority_digest !== digestDatabaseObjectAuthority(authority)) {
    diagnostics.push(databaseObjectAuthorityDiagnostic({
      subject: authority.revision, layer: "authority_digest",
      json_pointer: "/authority_digest", code: "source_digest_drift",
      canonical_identity: authority.authority_digest,
    }))
  }
  for (const field of ["objects", "runtime_compatibility",
    "migration_ownership", "public_mappings"] as const) {
    const keys = authority[field].map((item) => canonicalJson(item))
    if (new Set(keys).size !== keys.length) diagnostics.push(
      databaseObjectAuthorityDiagnostic({ subject: authority.revision,
        layer: "generated_model", json_pointer: `/${field}`,
        code: "duplicate_authority", canonical_identity: field }),
    )
    const orderKeys = field === "migration_ownership"
      ? authority.migration_ownership.map((item) => item.path)
      : keys
    if (canonicalJson(orderKeys) !==
      canonicalJson([...orderKeys].sort(compareUtf16))) {
      diagnostics.push(databaseObjectAuthorityDiagnostic({
        subject: authority.revision, layer: "generated_model",
        json_pointer: `/${field}`, code: "schema_invalid",
        canonical_identity: `${field}:canonical_utf16_order_required`,
      }))
    }
  }
  const owners = new Map<string, Set<string>>()
  for (const object of authority.objects) {
    const key = databaseObjectIdentityKey(object.identity)
    owners.set(key, new Set([...(owners.get(key) ?? []), object.owner_service]))
  }
  for (const [identity, values] of owners) if (values.size > 1) {
    diagnostics.push(databaseObjectAuthorityDiagnostic({
      subject: authority.revision, layer: "target_ownership",
      code: "target_owner_ambiguous", canonical_identity: identity,
    }))
  }
  for (const mapping of authority.public_mappings) {
    const key = databaseObjectIdentityKey(mapping.object)
    const capabilityMatches = mapping.object.class === "relation"
      ? mapping.capability === "relation.read"
      : mapping.object.class === "routine" && mapping.capability === "routine.call"
    const dynamicMatches = mapping.mapping_kind !== "dynamic_read_routines" ||
      Boolean(mapping.consumer_service && mapping.role &&
        mapping.allowed_schema === mapping.object.schema)
    if (!(owners.get(key)?.has(mapping.provider_service)) || !capabilityMatches ||
      !dynamicMatches) diagnostics.push(
      databaseObjectAuthorityDiagnostic({ subject: mapping.provider_service,
        layer: "public_mapping", source_path: mapping.source_path,
        json_pointer: mapping.json_pointer, code: "public_mapping_mismatch",
        object_class: mapping.object.class, canonical_identity: key,
        mode: mapping.capability }),
    )
  }
  return sortDatabaseObjectAuthorityDiagnostics(diagnostics)
}
