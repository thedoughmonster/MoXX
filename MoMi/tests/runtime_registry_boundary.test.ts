import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"

type DebtFinding = {
  evidence: { consumer_service: string; owner_service: string; relation: string }
  subject: string
}

test("keeps Runtime Registry relations private and resolvers fail-closed", async () => {
  const serviceRoot = join(workspaceRoot, "services", "runtime-registry")
  const manifest = JSON.parse(await readFile(join(serviceRoot, "service.json"), "utf8"))
  const rules = await readFile(join(serviceRoot, "AGENTS.md"), "utf8")
  const readme = await readFile(join(serviceRoot, "README.md"), "utf8")
  const catalog = await readFile(join(workspaceRoot, "docs", "service-catalog.md"), "utf8")
  const debt = JSON.parse(await readFile(join(
    workspaceRoot, "docs", "service-access-debt-baseline.json",
  ), "utf8")) as { findings: DebtFinding[] }
  const createSql = await readFile(join(
    workspaceRoot,
    "supabase/migrations/20260712142919_create_toast_source_function_registry.sql",
  ), "utf8")
  const moveSql = await readFile(join(
    workspaceRoot,
    "supabase/migrations/20260713070448_move_function_registry_to_momi_runtime.sql",
  ), "utf8")

  assert.equal(manifest.lifecycle_status, "active")
  assert.equal(manifest.implementation_status, "implemented")
  assert.match(catalog, /`runtime-registry` \| active \| implemented \| not_asserted/u)
  assert.deepEqual(manifest.owned_dataset.private_relations, [
    "momi_runtime.function_parameter_map",
    "momi_runtime.function_registry",
    "momi_runtime.function_trigger_registry",
  ])
  assert.deepEqual({
    functions: manifest.functions,
    provides: manifest.contracts.provides,
    consumes: manifest.contracts.consumes,
    publicReads: manifest.owned_dataset.public_reads,
    publicCommands: manifest.owned_dataset.public_commands,
    emittedEvents: manifest.owned_dataset.emitted_events,
    outboundHosts: manifest.network.outbound_hosts,
    secrets: manifest.secrets,
    configuration: manifest.configuration,
    deploymentOwns: manifest.deployment.owns,
    deploymentDependencies: manifest.deployment.depends_on,
    runtimeDependencies: manifest.runtime_dependencies,
    approvedPackages: manifest.approved_packages,
  }, {
    functions: [], provides: ["momi.runtime.active_trigger_resolution.v1"],
    consumes: [], publicReads: ["momi.runtime.active_trigger_resolution.v1"],
    publicCommands: [], emittedEvents: [], outboundHosts: [], secrets: [],
    configuration: [], deploymentOwns: [], deploymentDependencies: [],
    runtimeDependencies: [], approvedPackages: [],
  })
  assert.deepEqual(manifest.database, { read: ["momi_runtime"], write: ["momi_runtime"] })
  assert.equal("db_role" in manifest.owned_dataset, false)
  assert.equal(manifest.owned_dataset.private_routines.length, 6)
  assert.equal(manifest.owned_dataset.public_routine_reads.length, 6)
  assert(manifest.owned_dataset.public_routine_reads.every(
    (entry: { contract: string }) =>
      entry.contract === "momi.runtime.active_trigger_resolution.v1",
  ))

  assert.match(`${rules}\n${readme}`, /momi\.runtime\.active_trigger_resolution\.v1/u)
  assert.match(readme, /availability is `not_asserted`/u)
  assert.match(`${rules}\n${readme}`, /private implementation details/u)
  assert.match(rules, /exact consumer-role grants/u)
  assert.match(rules, /Do not grant schema-wide access/u)
  assert.match(`${rules}\n${readme}`, /shared (hosted|Edge project) credentials/u)
  assert.match(`${rules}\n${readme}`, /removal-only legacy debt/u)
  assert.match(`${rules}\n${readme}`, /separately accepted versioned owner contract/u)
  assert.match(`${rules}\n${readme}`, /caller compatibility and cutover/u)
  assert.match(`${rules}\n${readme}`, /failure semantics/u)
  assert.match(`${rules}\n${readme}`, /separately authorized role and grant work/u)

  for (const relation of [
    "function_parameter_map", "function_registry", "function_trigger_registry",
  ]) {
    assert.match(createSql, new RegExp(`create table toast_hydration\\.${relation}`, "u"))
    assert.match(createSql, new RegExp(`alter table toast_hydration\\.${relation}` +
      " enable row level security", "u"))
    assert.match(moveSql, new RegExp(`alter table toast_hydration\\.${relation}` +
      "[\\s\\S]*set schema momi_runtime", "u"))
  }
  assert.match(moveSql, /revoke all on schema momi_runtime from public, anon, authenticated/u)
  assert.match(moveSql, /revoke all on all tables in schema momi_runtime[\s\S]*public, anon, authenticated/u)
  assert.doesNotMatch(`${createSql}\n${moveSql}`, /\bgrant\b[^;]*momi_runtime/iu)

  const findings = debt.findings.filter((finding) =>
    finding.evidence.owner_service === "runtime-registry")
  assert.deepEqual(findings, [])
})
