import { readdir } from "node:fs/promises"
import { join } from "node:path"

import { buildExecutionAuthorityDatabaseOwners } from
  "./build_execution_authority_database_owners.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import { digestServiceAuthoritySource } from
  "./digest_service_authority_source.ts"
import type { ExecutionAuthority } from "./execution_authority_types.ts"
import { readJson } from "./read_json.ts"
import type {
  ServiceAccessDebtFinding,
  ServiceAuthorityBindingContext,
  ServiceAuthorityBindingTrustContext,
} from "./service_authority_binding_types.ts"
import type { LoadedService } from "./types.ts"
import { validateJson } from "./validate_json.ts"
import { repositoryAuthority } from "./repository_authority.ts"

export async function loadServiceAuthorityBindingContext(
  root: string,
  services: LoadedService[],
  revision: string,
  executionTrust: ServiceAuthorityBindingTrustContext["execution"],
): Promise<ServiceAuthorityBindingContext> {
  const debtPath = join(root, "docs", "service-access-debt-baseline.json")
  const debtSchema = await readJson<{ $id: string }>(join(
    root, "schemas", "service-access-debt-baseline-v1.schema.json",
  ))
  const debt = await readJson<{
    schema_version: number
    findings: ServiceAccessDebtFinding[]
  }>(debtPath)
  validateJson(debtSchema, debt, "service access debt baseline")
  const executionSchema = await readJson<object>(join(
    root, "schemas", "execution-authority-v1.schema.json",
  ))
  const executions: ServiceAuthorityBindingContext["executions"] = {}
  const executionDirectory = join(root, "execution-authorities")
  let entries = []
  try {
    entries = await readdir(executionDirectory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  for (const entry of entries.sort((left, right) =>
    compareUtf16(left.name, right.name))) {
    if (entry.isSymbolicLink() || !entry.isFile() ||
      !entry.name.endsWith(".json")) continue
    const source_path = `execution-authorities/${entry.name}`
    const value = await readJson<ExecutionAuthority>(join(root, source_path))
    executions[value.grant_id] = [
      ...(executions[value.grant_id] ?? []), { source_path, value },
    ]
  }
  const manifests = Object.fromEntries(services.map(({ manifest }) => [
    manifest.service_key,
    { source_path: `services/${manifest.service_key}/service.json`,
      value: manifest },
  ]))
  const serviceAuthorities = Object.fromEntries(services.map(({ manifest }) => [
    manifest.service_key,
    { database: manifest.database,
      provides: manifest.contracts.provides,
      consumes: manifest.contracts.consumes.map((item) =>
        `${item.service}:${item.contract}`),
      network: manifest.network.outbound_hosts,
      secrets: manifest.secrets, packages: manifest.approved_packages },
  ]))
  const debtTargets = debt.findings.flatMap((finding) => {
    const key = finding.rule_id === "direct_private_relation_access"
      ? "relation"
      : finding.rule_id === "direct_private_routine_call" ? "routine" : ""
    return key && finding.evidence[key] ? [finding.evidence[key]] : []
  })
  return {
    root, repository: repositoryAuthority, revision, manifests,
    debt: { source_path: "docs/service-access-debt-baseline.json",
      schema_id: debtSchema.$id, schema_version: debt.schema_version,
      source_digest: await digestServiceAuthoritySource(debtPath),
      findings: debt.findings },
    executions, execution_schema: executionSchema, execution_trust: executionTrust,
    execution_context: {
      root, repository: repositoryAuthority,
      baseRevision: "", sourceDigest: "", services: serviceAuthorities,
      databaseOwners: buildExecutionAuthorityDatabaseOwners(services),
      externalAuthorities: [], debtTargets: [...new Set(debtTargets)].sort(),
    },
  }
}
