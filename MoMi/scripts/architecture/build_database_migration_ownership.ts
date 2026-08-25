import { compareUtf16 } from "./compare_utf16.ts"
import type { DatabaseObjectAuthorityRevision } from
  "./database_object_authority_types.ts"

export function buildDatabaseMigrationOwnership(
  source: DatabaseObjectAuthorityRevision,
): Array<{ path: string; blob_id: string; owner_service: string;
  mode: "migration.own" }> {
  const values: Array<{ path: string; blob_id: string; owner_service: string;
    mode: "migration.own" }> = []
  for (const migration of source.migrations) {
    const firstLine = migration.source.split(/\r?\n/u, 1)[0] ?? ""
    const owner = firstLine.match(
      /^-- service-owner: ([a-z0-9]+(?:-[a-z0-9]+)*)$/u,
    )?.[1]
    if (owner) values.push({ path: migration.path, blob_id: migration.blob_id,
      owner_service: owner, mode: "migration.own" })
  }
  return values.sort((left, right) => compareUtf16(left.path, right.path))
}
