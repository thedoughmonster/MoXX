import { readdir } from "node:fs/promises"
import { join } from "node:path"

import { buildExecutionAuthorityDatabaseOwners } from
  "./build_execution_authority_database_owners.ts"
import { buildDatabaseObjectAuthority } from
  "./build_database_object_authority.ts"
import type {
  ExecutionAuthority,
  ExecutionAuthorityTrustContext,
  LoadedExecutionAuthority,
} from "./execution_authority_types.ts"
import type { ExecutionAuthorityV2 } from "./execution_authority_v2_types.ts"
import { findExecutionAuthorityIdentityViolations } from
  "./find_execution_authority_identity_violations.ts"
import { loadExecutionAuthorityDebtTargets } from
  "./load_execution_authority_debt_targets.ts"
import type { LoadedService } from "./types.ts"
import { readJson } from "./read_json.ts"
import { validateExecutionAuthority } from "./validate_execution_authority.ts"
import { validateExecutionAuthorityV2 } from
  "./validate_execution_authority_v2.ts"
import { workspaceRoot } from "./paths.ts"

export async function findExecutionAuthorityViolations(
  services: LoadedService[],
  root = workspaceRoot,
  trust?: ExecutionAuthorityTrustContext,
): Promise<string[]> {
  const directory = join(root, "execution-authorities")
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
  const schema = await readJson<object>(
    join(root, "schemas", "execution-authority-v1.schema.json"),
  )
  const indexed = Object.fromEntries(services.map(({ manifest }) => [
    manifest.service_key,
    {
      database: manifest.database,
      provides: manifest.contracts.provides,
      consumes: manifest.contracts.consumes.map((item) =>
        `${item.service}:${item.contract}`),
      network: manifest.network.outbound_hosts,
      secrets: manifest.secrets,
      packages: manifest.approved_packages,
    },
  ]))
  const databaseOwners = buildExecutionAuthorityDatabaseOwners(services)
  const violations: string[] = []
  const grants: LoadedExecutionAuthority[] = []
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name))) {
    const label = `execution-authorities/${entry.name}`
    if (entry.isSymbolicLink() || !entry.isFile() ||
      !entry.name.endsWith(".json")) {
      violations.push(`${label}: only JSON files are allowed`)
      continue
    }
    grants.push({
      label,
      grant: await readJson<ExecutionAuthority | ExecutionAuthorityV2>(
        join(directory, entry.name),
      ),
    })
  }
  violations.push(...findExecutionAuthorityIdentityViolations(grants))
  const debtTargets = await loadExecutionAuthorityDebtTargets(root)
  let databaseAuthority: ReturnType<typeof buildDatabaseObjectAuthority> | undefined
  let databaseAuthoritySchema: object | undefined
  let v2Schema: object | undefined
  for (const { label, grant } of grants) {
    const accepted = trust?.grants[grant.work_item]
    const context = {
      root,
      repository: "thedoughmonster/momi-backend",
      baseRevision: accepted?.baseRevision ?? "",
      sourceDigest: accepted?.sourceDigest ?? "",
      services: indexed,
      databaseOwners,
      externalAuthorities: accepted?.externalAuthorities ?? [],
      debtTargets,
    }
    if (grant.schema_version === "execution-authority/v2") {
      databaseAuthority ??= buildDatabaseObjectAuthority(root, "HEAD")
      databaseAuthoritySchema ??= await readJson<object>(
        join(root, "schemas", "database-object-authority-v1.schema.json"),
      )
      v2Schema ??= await readJson<object>(
        join(root, "schemas", "execution-authority-v2.schema.json"),
      )
      const diagnostics = await validateExecutionAuthorityV2(
        grant, v2Schema, schema,
        { ...context, databaseObjectAuthority: databaseAuthority.authority,
          databaseObjectAuthoritySchema: databaseAuthoritySchema,
          databaseObjectAuthorityDiagnostics: databaseAuthority.diagnostics },
      )
      violations.push(...diagnostics.map((item) =>
        `${label}: ${JSON.stringify(item)}`))
    } else {
      const diagnostics = await validateExecutionAuthority(grant, schema, context)
      violations.push(...diagnostics.map((item) =>
        `${label}${item.field_path}: ${item.code}: ${item.target}`))
    }
  }
  return violations.sort((left, right) => left.localeCompare(right))
}
