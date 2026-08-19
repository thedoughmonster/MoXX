import Ajv2020 from "ajv/dist/2020.js"

import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { databaseObjectAuthorityDiagnostic } from
  "./database_object_authority_diagnostic.ts"
import type { DatabaseObjectAuthorityDiagnostic } from
  "./database_object_authority_types.ts"
import { findExecutionAuthorityV2DatabaseDiagnostics } from
  "./find_execution_authority_v2_database_diagnostics.ts"
import type {
  ExecutionAuthorityV2,
  ExecutionAuthorityV2Context,
} from "./execution_authority_v2_types.ts"
import type { ExecutionAuthority } from "./execution_authority_types.ts"
import { sortDatabaseObjectAuthorityDiagnostics } from
  "./sort_database_object_authority_diagnostics.ts"
import { validateExecutionAuthority } from "./validate_execution_authority.ts"
import { validateDatabaseObjectAuthority } from
  "./validate_database_object_authority.ts"

export async function validateExecutionAuthorityV2(
  value: unknown,
  schema: object,
  v1Schema: object,
  context: ExecutionAuthorityV2Context,
): Promise<DatabaseObjectAuthorityDiagnostic[]> {
  const raw = value as Partial<ExecutionAuthorityV2> & {
    database?: { capabilities?: Array<{ object?: Record<string, unknown>;
      mode?: unknown }> }
  }
  const grantId = typeof raw?.grant_id === "string" ? raw.grant_id : "<unknown>"
  const diagnostics: DatabaseObjectAuthorityDiagnostic[] = []
  if (raw?.schema_version !== "execution-authority/v2") return [
    databaseObjectAuthorityDiagnostic({ subject: grantId,
      layer: "positive_authority", json_pointer: "/schema_version",
      code: "unknown_version", canonical_identity: String(raw?.schema_version) }),
  ]
  const modelDiagnostics = sortDatabaseObjectAuthorityDiagnostics([
    ...context.databaseObjectAuthorityDiagnostics,
    ...validateDatabaseObjectAuthority(
      context.databaseObjectAuthority,
      context.databaseObjectAuthoritySchema,
    ),
  ])
  if (modelDiagnostics.length > 0) return modelDiagnostics
  const seen = new Set<string>()
  for (const [index, capability] of (raw.database?.capabilities ?? []).entries()) {
    const object = capability?.object
    const objectClass = typeof object?.class === "string" ? object.class : ""
    const identity = object ? canonicalJson(object) : ""
    const key = canonicalJson([object, capability.mode])
    if (seen.has(key)) diagnostics.push(databaseObjectAuthorityDiagnostic({
      subject: grantId, layer: "positive_authority",
      json_pointer: `/database/capabilities/${index}`,
      code: "duplicate_authority", object_class: objectClass,
      canonical_identity: identity, mode: String(capability.mode ?? ""),
    }))
    seen.add(key)
    if (objectClass === "schema") diagnostics.push(
      databaseObjectAuthorityDiagnostic({ subject: grantId,
        layer: "positive_authority",
        json_pointer: `/database/capabilities/${index}/object/class`,
        code: "broad_positive_authority", object_class: objectClass,
        canonical_identity: identity, mode: String(capability.mode ?? "") }),
    )
    else if (objectClass !== "relation" && objectClass !== "routine" &&
      objectClass !== "sequence") diagnostics.push(
        databaseObjectAuthorityDiagnostic({ subject: grantId,
          layer: "positive_authority",
          json_pointer: `/database/capabilities/${index}/object/class`,
          code: "unknown_object_class", object_class: objectClass,
          canonical_identity: identity, mode: String(capability.mode ?? "") }),
      )
    if (objectClass === "routine" && !Array.isArray(object?.arguments)) {
      const matches = context.databaseObjectAuthority.objects.filter((item) =>
        item.identity.class === "routine" && item.identity.schema === object?.schema &&
        item.identity.name === object?.name)
      if (matches.length > 1) diagnostics.push(
        databaseObjectAuthorityDiagnostic({ subject: grantId,
          layer: "positive_authority",
          json_pointer: `/database/capabilities/${index}/object/arguments`,
          code: "ambiguous_object_identity", object_class: "routine",
          canonical_identity: identity, mode: String(capability.mode ?? "") }),
      )
    }
  }
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)
  if (!validate(value)) {
    for (const error of validate.errors ?? []) diagnostics.push(
      databaseObjectAuthorityDiagnostic({ subject: grantId,
        layer: "positive_authority", json_pointer: error.instancePath || "/",
        code: "schema_invalid", canonical_identity:
          `${error.keyword}:${error.message ?? "invalid"}` }),
    )
    return sortDatabaseObjectAuthorityDiagnostics(diagnostics)
  }
  const grant = value as ExecutionAuthorityV2
  const { database: _database, ...nonDatabase } = grant
  const projected = { ...nonDatabase, schema_version: "execution-authority/v1",
    database: { read: [], write: [] } } as ExecutionAuthority
  for (const diagnostic of await validateExecutionAuthority(
    projected, v1Schema, context,
  )) diagnostics.push(databaseObjectAuthorityDiagnostic({
    subject: diagnostic.grant_id, layer: "execution_authority",
    json_pointer: diagnostic.field_path, code: diagnostic.code,
    canonical_identity: diagnostic.target,
  }))
  diagnostics.push(...findExecutionAuthorityV2DatabaseDiagnostics(grant, context))
  return sortDatabaseObjectAuthorityDiagnostics(diagnostics)
}
