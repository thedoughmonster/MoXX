import { join } from "node:path"

import { buildExecutionAuthorityDatabaseOwners } from
  "../scripts/architecture/build_execution_authority_database_owners.ts"
import { digestServiceAuthoritySource } from
  "../scripts/architecture/digest_service_authority_source.ts"
import type { ExecutionAuthority } from
  "../scripts/architecture/execution_authority_types.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import type {
  ServiceAccessDebtFinding,
  ServiceAuthorityBindingContext,
} from "../scripts/architecture/service_authority_binding_types.ts"
import type { LoadedService, ServiceManifest } from
  "../scripts/architecture/types.ts"
import { validateJson } from "../scripts/architecture/validate_json.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"

export const bindingFixtureRoot = join(
  workspaceRoot, "tests", "fixtures", "service-authority-binding",
)
export const bindingSourceRoot = join(bindingFixtureRoot, "repository")
export const bindingSchema = await readJson<object>(join(
  workspaceRoot, "schemas", "service-authority-binding-v1.schema.json",
))
const serviceSchema = await readJson<object>(join(
  workspaceRoot, "schemas", "service-manifest-v1.schema.json",
))
const debtSchema = await readJson<{ $id: string }>(join(
  workspaceRoot, "schemas", "service-access-debt-baseline-v1.schema.json",
))
const executionSchema = await readJson<object>(join(
  workspaceRoot, "schemas", "execution-authority-v1.schema.json",
))
const owner = await readJson<ServiceManifest>(join(
  bindingSourceRoot, "services", "fixture-owner", "service.json",
))
const noDataset = await readJson<ServiceManifest>(join(
  bindingSourceRoot, "services", "fixture-no-dataset", "service.json",
))
const dynamicDebt = await readJson<ServiceManifest>(join(
  bindingSourceRoot, "services", "fixture-dynamic-debt", "service.json",
))
validateJson(serviceSchema, owner, "fixture-owner manifest")
validateJson(serviceSchema, noDataset, "fixture-no-dataset manifest")
validateJson(serviceSchema, dynamicDebt, "fixture-dynamic-debt manifest")
const services: LoadedService[] = [owner, noDataset, dynamicDebt].map((manifest) => ({
  directory: join(bindingSourceRoot, "services", manifest.service_key), manifest,
}))
const debtPath = join(
  bindingSourceRoot, "docs", "service-access-debt-baseline.json",
)
const debt = await readJson<{
  schema_version: number
  findings: ServiceAccessDebtFinding[]
}>(debtPath)
validateJson(debtSchema, debt, "fixture debt baseline")
const exact = await readJson<ExecutionAuthority>(join(
  bindingSourceRoot, "execution-authorities", "exact.json",
))
const widened = await readJson<ExecutionAuthority>(join(
  bindingSourceRoot, "execution-authorities", "widened.json",
))
validateJson(executionSchema, exact, "exact execution fixture")
validateJson(executionSchema, widened, "widened execution fixture")
const manifests = Object.fromEntries(services.map(({ manifest }) => [
  manifest.service_key,
  { source_path: `services/${manifest.service_key}/service.json`, value: manifest },
]))
const authority = Object.fromEntries(services.map(({ manifest }) => [
  manifest.service_key,
  { database: manifest.database, provides: manifest.contracts.provides,
    consumes: manifest.contracts.consumes.map((item) =>
      `${item.service}:${item.contract}`),
    network: manifest.network.outbound_hosts, secrets: manifest.secrets,
    packages: manifest.approved_packages },
]))
export const bindingContext: ServiceAuthorityBindingContext = {
  root: bindingSourceRoot,
  repository: "thedoughmonster/momi-backend",
  revision: "1111111111111111111111111111111111111111",
  manifests,
  debt: {
    source_path: "docs/service-access-debt-baseline.json",
    schema_id: debtSchema.$id,
    schema_version: debt.schema_version,
    source_digest: await digestServiceAuthoritySource(debtPath),
    findings: debt.findings,
  },
  executions: {
    [exact.grant_id]: [{ source_path: "execution-authorities/exact.json",
      value: exact }],
    [widened.grant_id]: [{ source_path: "execution-authorities/widened.json",
      value: widened }],
  },
  execution_schema: executionSchema,
  execution_trust: { grants: { "MOX-204": {
    baseRevision: "1111111111111111111111111111111111111111",
    sourceDigest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    externalAuthorities: [],
  } } },
  execution_context: {
    root: bindingSourceRoot, repository: "thedoughmonster/momi-backend",
    baseRevision: "", sourceDigest: "", services: authority,
    databaseOwners: buildExecutionAuthorityDatabaseOwners(services),
    externalAuthorities: [], debtTargets: ["fixture_private.records"],
  },
}
