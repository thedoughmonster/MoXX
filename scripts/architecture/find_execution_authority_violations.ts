import { readdir } from "node:fs/promises"
import { join } from "node:path"

import type {
  ExecutionAuthority,
  LoadedExecutionAuthority,
} from "./execution_authority_types.ts"
import { findExecutionAuthorityIdentityViolations } from
  "./find_execution_authority_identity_violations.ts"
import { loadExecutionAuthorityDebtTargets } from
  "./load_execution_authority_debt_targets.ts"
import type { LoadedService } from "./types.ts"
import { readJson } from "./read_json.ts"
import { validateExecutionAuthority } from "./validate_execution_authority.ts"
import { workspaceRoot } from "./paths.ts"

export async function findExecutionAuthorityViolations(
  services: LoadedService[],
  root = workspaceRoot,
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
      grant: await readJson<ExecutionAuthority>(join(directory, entry.name)),
    })
  }
  violations.push(...findExecutionAuthorityIdentityViolations(grants))
  const debtTargets = await loadExecutionAuthorityDebtTargets(root)
  for (const { label, grant } of grants) {
    const diagnostics = await validateExecutionAuthority(grant, schema, {
      root,
      repository: "thedoughmonster/momi-backend",
      baseRevision: process.env.MOMI_BASE_REF ?? "",
      sourceDigest: process.env.MOMI_EXECUTION_AUTHORITY_SOURCE_DIGEST ?? "",
      services: indexed,
      externalAuthorities: [],
      debtTargets,
    })
    violations.push(...diagnostics.map((item) =>
      `${label}${item.field_path}: ${item.code}: ${item.target}`))
  }
  return violations.sort((left, right) => left.localeCompare(right))
}
