import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"

test("keeps Archive Governance implemented, private, and fail-closed", async () => {
  const serviceRoot = join(workspaceRoot, "services", "archive-governance")
  const manifest = JSON.parse(await readFile(join(serviceRoot, "service.json"), "utf8"))
  const rules = await readFile(join(serviceRoot, "AGENTS.md"), "utf8")
  const readme = await readFile(join(serviceRoot, "README.md"), "utf8")
  const catalog = await readFile(join(workspaceRoot, "docs", "service-catalog.md"), "utf8")
  const runbook = await readFile(join(
    workspaceRoot, "docs", "toast-exit-archive-runbook.md",
  ), "utf8")
  const createSql = await readFile(join(
    workspaceRoot,
    "supabase/migrations/20260714174856_create_momi_archive_export_register.sql",
  ), "utf8")
  const hardenSql = await readFile(join(
    workspaceRoot,
    "supabase/migrations/20260715150000_harden_manual_export_evidence.sql",
  ), "utf8")

  assert.equal(manifest.lifecycle_status, "active")
  assert.equal(manifest.implementation_status, "implemented")
  assert.match(catalog, /`archive-governance` \| active \| implemented \| not_asserted/u)
  assert.deepEqual(manifest.owned_dataset.private_relations, [
    "momi_archive.export_runs",
    "momi_archive.manual_export_findings_v1",
    "momi_archive.product_export_status_v1",
    "momi_archive.product_gap_register",
  ])
  assert.deepEqual(manifest.owned_dataset.private_routines, [
    "momi_archive.reject_export_run_mutation",
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
    functions: [], provides: [], consumes: [], publicReads: [],
    publicCommands: [], emittedEvents: [], outboundHosts: [], secrets: [],
    configuration: [], deploymentOwns: [], deploymentDependencies: [],
    runtimeDependencies: [], approvedPackages: [],
  })
  assert.deepEqual(manifest.database, { read: ["momi_archive"], write: ["momi_archive"] })
  assert.equal("db_role" in manifest.owned_dataset, false)
  assert.doesNotMatch(JSON.stringify(manifest), /source[_-]?(?:evidence|records)/iu)
  assert.match(`${rules}\n${readme}`, /Source evidence remains owned and stored/u)
  assert.match(`${rules}\n${readme}`, /no current public contract/u)
  assert.match(runbook, /runbook grants no identity, credential, role, permission/u)
  assert.match(runbook, /no identity, credential[\s\S]*direct private-object access/u)
  assert.match(hardenSql, /before update or delete on momi_archive\.export_runs/u)
  assert.match(hardenSql, /before truncate on momi_archive\.export_runs/u)
  assert.match(hardenSql, /Manual export evidence is append-only/u)
  assert.match(createSql, /revoke all on schema momi_archive from public, anon, authenticated/u)
  assert.match(createSql, /revoke all on all tables in schema momi_archive[\s\S]*public, anon, authenticated/u)
  assert.match(hardenSql, new RegExp(
    "revoke all on function momi_archive\\.reject_export_run_mutation\\(\\)" +
      "[\\s\\S]*public, anon, authenticated",
    "u",
  ))
  assert.match(hardenSql, new RegExp(
    "revoke all on momi_archive\\.product_export_status_v1," +
      "[\\s\\S]*momi_archive\\.manual_export_findings_v1" +
      "[\\s\\S]*public, anon, authenticated",
    "u",
  ))
  assert.doesNotMatch(`${createSql}\n${hardenSql}`, /\bgrant\b[^;]*momi_archive/iu)
})
