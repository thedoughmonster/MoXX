import { join } from "node:path"

import { buildDatabaseObjectAuthority } from
  "./build_database_object_authority.ts"
import { databaseObjectAuthorityDiagnostic } from
  "./database_object_authority_diagnostic.ts"
import { findDatabaseObjectAuthorityRatchetDiagnostics } from
  "./find_database_object_authority_ratchet_diagnostics.ts"
import { readJson } from "./read_json.ts"
import { sortDatabaseObjectAuthorityDiagnostics } from
  "./sort_database_object_authority_diagnostics.ts"
import { validateDatabaseObjectAuthority } from
  "./validate_database_object_authority.ts"

export async function findDatabaseObjectAuthorityViolations(
  root: string,
  baseRevision = "origin/dev",
  candidateRevision = "HEAD",
): Promise<string[]> {
  let base
  try {
    base = buildDatabaseObjectAuthority(root, baseRevision)
  } catch {
    const diagnostic = databaseObjectAuthorityDiagnostic({
      subject: baseRevision, layer: "ratchet", code: "ratchet_baseline_unavailable",
      canonical_identity: baseRevision,
    })
    return [JSON.stringify(diagnostic)]
  }
  const candidate = buildDatabaseObjectAuthority(root, candidateRevision)
  const schema = await readJson<object>(join(
    root, "schemas", "database-object-authority-v1.schema.json",
  ))
  const diagnostics = sortDatabaseObjectAuthorityDiagnostics([
    ...base.diagnostics, ...candidate.diagnostics,
    ...validateDatabaseObjectAuthority(candidate.authority, schema),
    ...findDatabaseObjectAuthorityRatchetDiagnostics(
      base.authority, candidate.authority,
    ),
  ])
  return diagnostics.map((item) => JSON.stringify(item))
}
