import { createHash } from "node:crypto"

import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { buildDatabaseAuthorityObjects } from
  "./build_database_authority_objects.ts"
import { buildDatabaseMigrationOwnership } from
  "./build_database_migration_ownership.ts"
import { buildDatabaseObjectCatalog } from "./build_database_object_catalog.ts"
import { buildDatabasePublicMappings } from "./build_database_public_mappings.ts"
import { buildDatabaseRuntimeCompatibility } from
  "./build_database_runtime_compatibility.ts"
import { digestDatabaseObjectAuthority } from
  "./digest_database_object_authority.ts"
import type { DatabaseObjectAuthorityResult } from
  "./database_object_authority_types.ts"
import { loadDatabaseObjectAuthorityRevision } from
  "./load_database_object_authority_revision.ts"
import { sortDatabaseObjectAuthorityDiagnostics } from
  "./sort_database_object_authority_diagnostics.ts"

export function buildDatabaseObjectAuthority(
  root: string,
  revision: string,
): DatabaseObjectAuthorityResult {
  const source = loadDatabaseObjectAuthorityRevision(root, revision)
  const catalog = buildDatabaseObjectCatalog(source)
  const objectResult = buildDatabaseAuthorityObjects(source, catalog)
  const runtimeResult = buildDatabaseRuntimeCompatibility(source, catalog)
  const mappingResult = buildDatabasePublicMappings(source, catalog)
  const source_digest = createHash("sha256").update(
    canonicalJson(source.source_descriptors),
  ).digest("hex")
  const debtDigest = createHash("sha256").update(source.legacy_debt.source)
    .digest("hex")
  const partial = {
    $schema: "../../schemas/database-object-authority-v1.schema.json",
    schema_version: "database-object-authority/v1" as const,
    repository: source.repository, revision: source.revision, source_digest,
    objects: objectResult.objects,
    runtime_compatibility: runtimeResult.runtime_compatibility,
    migration_ownership: buildDatabaseMigrationOwnership(source),
    public_mappings: mappingResult.public_mappings,
    legacy_debt_reference: { path: source.legacy_debt.path,
      schema_version: source.legacy_debt.schema_version, digest: debtDigest },
  }
  const authority = { ...partial,
    authority_digest: digestDatabaseObjectAuthority(partial) }
  return { authority, diagnostics: sortDatabaseObjectAuthorityDiagnostics([
    ...objectResult.diagnostics, ...runtimeResult.diagnostics,
    ...mappingResult.diagnostics,
  ]) }
}
