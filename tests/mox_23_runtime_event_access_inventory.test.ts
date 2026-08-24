import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { validateArchitecture } from "../scripts/architecture/validate_architecture.ts"
import { buildDatabaseSourceModules } from "../scripts/constitution/build_database_source_modules.ts"
import { collectRelationActions } from "../scripts/constitution/collect_relation_actions.ts"
import { collectRoutineActions } from "../scripts/constitution/collect_routine_actions.ts"
import { findRuntimeAccessFindings } from "../scripts/constitution/find_runtime_access_findings.ts"
import { replayRelationDefinitions } from "../scripts/constitution/replay_relation_definitions.ts"
import { replayRoutineDefinitions } from "../scripts/constitution/replay_routine_definitions.ts"
import { loadLocalMigrations } from "../scripts/migrations/load_local_migrations.ts"
type Row = { fingerprint: string; subject: string; physical_source: string
  consumer_service: string; owner_service: string; access: string; object: string
  reference_count: number; disposition: string; proposed_target: string }
type Finding = { fingerprint: string; subject: string; evidence: Record<string, string> }
type Inventory = { document_status: string; issue: string; base_sha: string; source: string
  scope_note: string; implemented_fingerprints: number; remaining_fingerprints: number
  summary: unknown; findings: Row[] }
const architecture = await validateArchitecture()
const migrations = await loadLocalMigrations(join(workspaceRoot,
  architecture.workspace.paths.migrations))
const routineDefinitions = replayRoutineDefinitions(migrations)
const relationDefinitions = replayRelationDefinitions(migrations)
const modules = buildDatabaseSourceModules(architecture.services,
  relationDefinitions, routineDefinitions)
const owners = new Set(["runtime-registry", "momi-event-routing"])
const generated = findRuntimeAccessFindings(architecture.services,
  [...architecture.modules, ...modules]).filter((finding) =>
    owners.has(finding.evidence.owner_service))
const [baseline, inventory] = await Promise.all([
  readFile(new URL("../docs/service-access-debt-baseline.json", import.meta.url), "utf8")
    .then((value) => JSON.parse(value) as { findings: Finding[] }),
  readFile(new URL("../docs/mox-23-runtime-event-access-inventory.json", import.meta.url),
    "utf8").then((value) => JSON.parse(value) as Inventory),
])
const relevant = baseline.findings.filter((finding) => owners.has(finding.evidence.owner_service))
const groups: Array<[string, string, string[]]> = [
  ["existing_public_contract", "momi.events.append.v1", ["sha256:599e583a358067a25d35cbb0d2a27faba1cb47796044e1f7e93789257582a44a"]],
  ["missing_owner_contract", "proposal:event_exact_delivery_lifecycle", ["sha256:51196ed750600fa97fbf6fbcd3f27c32d22da9f325a8c9da1c7c7b7298ddf8a9", "sha256:496e0e7dc9c46fe33eca0e88033c943c230e3d4b4dcc86ab1a6b1439215027d0"]],
  ["missing_owner_contract", "proposal:event_exact_delivery_reference_read", ["sha256:ccf7b66c847cfb2c7810ffd01d62dbd2048ce09c33afae1617c73cae43b71b88", "sha256:4333db468efbb05539a0aa2cc793257acc6b5623f6e70fc8389ebd8828ddf426"]],
  ["missing_owner_contract", "proposal:event_exact_warehouse_append", ["sha256:4b0241d8f448da563a65e347b8eb5ade29ecc2745b5017b9efa4ad4b1a1c1c91", "sha256:3e000bd8611227c83d9c9739d3ebab48bc514d8f9027eebd800ba18bc4c99f33", "sha256:d32c2a4199b3b32d392a48de659b6f6220c149287e02648e3bcd982192119403"]],
]
const expected = new Map(groups.flatMap(([disposition, proposed_target, fingerprints]) =>
  fingerprints.map((fingerprint) => [fingerprint, { disposition, proposed_target }])))

const checks = {
  activeOrigins(): Map<string, string> {
    const origins = new Map<string, string>()
    for (const [file, source] of migrations) {
      for (const action of collectRoutineActions(file, source)) {
        if (action.operation !== "create" || !routineDefinitions.has(action.identity!)) continue
        const definition = routineDefinitions.get(action.identity!)!
        const suffix = createHash("sha256").update(action.identity!).digest("hex").slice(0, 12)
        origins.set(`database/routines/${definition.name}--${suffix}.sql`,
          `supabase/migrations/${file}`)
      }
      for (const action of collectRelationActions(file, source)) if (
        action.operation === "create" && relationDefinitions.has(action.name)) {
        origins.set(`database/views/${action.name}.sql`, `supabase/migrations/${file}`)
      }
    }
    return origins
  },
  countBy(rows: Row[], key: keyof Row): Record<string, number> {
    const counts = new Map<string, number>()
    for (const row of rows) counts.set(String(row[key]),
      (counts.get(String(row[key])) ?? 0) + 1)
    return Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b)))
  },
  assertOrigins(rows: Row[], origins: Map<string, string>): void {
    for (const row of rows) assert.equal(row.physical_source,
      row.subject.startsWith("services/") ? row.subject : origins.get(row.subject),
      row.fingerprint)
  },
  assertInventory(candidate: Inventory): void {
    const rows = candidate.findings
    assert.deepEqual([candidate.document_status, candidate.issue, candidate.base_sha,
      candidate.source, candidate.scope_note], ["implemented_partial", "MOX-23",
      "45c91bc4ee06ab3c476d8251f6834699ccff8e6a",
      "docs/service-access-debt-baseline.json", "Implemented 27 of the original 35 private-access removals; the remaining 8 are intentionally deferred to separately owned follow-up work. Shared Edge credentials remain a known hardening dependency and do not prove per-service workload isolation."])
    assert.deepEqual([candidate.implemented_fingerprints,
      candidate.remaining_fingerprints], [27, 8])
    assert.equal(rows.length, 8)
    assert.equal(new Set(rows.map((row) => row.fingerprint)).size, 8)
    assert.deepEqual(groups.map((group) => group[2].length), [1, 2, 2, 3])
    assert.equal(expected.size, 8)
    for (const row of rows) assert.deepEqual(
      { disposition: row.disposition, proposed_target: row.proposed_target },
      expected.get(row.fingerprint), row.fingerprint)
    assert.deepEqual(candidate.summary, { fingerprints: 8, virtual_subjects:
      new Set(rows.map((row) => row.subject)).size, physical_sources:
      new Set(rows.map((row) => row.physical_source)).size, consumers:
      new Set(rows.map((row) => row.consumer_service)).size,
      owner_counts: checks.countBy(rows, "owner_service"), disposition_counts:
      checks.countBy(rows, "disposition"), consumer_counts:
      checks.countBy(rows, "consumer_service") })
  },
}
const origins = checks.activeOrigins()
test("regenerates exact evidence and validates active origins", () => {
  checks.assertInventory(inventory)
  const evidence = (findings: Finding[]) => findings.map(({ fingerprint, evidence }) =>
    ({ fingerprint, evidence })).sort((a, b) => a.fingerprint.localeCompare(b.fingerprint))
  assert.deepEqual(evidence(generated), evidence(relevant))
  const byFingerprint = new Map(relevant.map((finding) => [finding.fingerprint, finding]))
  for (const row of inventory.findings) {
    const finding = byFingerprint.get(row.fingerprint)!
    assert.deepEqual([row.subject, row.consumer_service, row.owner_service, row.access,
      row.object, row.reference_count], [finding.subject, finding.evidence.consumer_service,
      finding.evidence.owner_service, finding.evidence.access,
      finding.evidence.relation ?? finding.evidence.routine,
      Number(finding.evidence.reference_count)])
  }
  checks.assertOrigins(inventory.findings, origins)
  assert.equal(baseline.findings.length, 87)
})
test("rejects duplicate rows and arbitrary targets", () => {
  checks.assertInventory(inventory)
  assert.throws(() => checks.assertInventory({ ...inventory,
    findings: [...inventory.findings, inventory.findings[0]] }))
  assert.throws(() => checks.assertInventory({ ...inventory, findings:
    inventory.findings.map((row, index) => index === 0
      ? { ...row, proposed_target: "proposal:arbitrary" } : row) }))
  assert.throws(() => checks.assertInventory({ ...inventory,
    scope_note: inventory.scope_note.replace("intentionally deferred", "completed") }))
})
test("rejects a wrong same-object migration", () => {
  checks.assertInventory(inventory)
  const row = inventory.findings.find((item) => item.subject.startsWith("database/"))!
  const wrong = [...migrations].find(([file, source]) => source.includes(row.object) &&
    `supabase/migrations/${file}` !== row.physical_source)
  assert.ok(wrong)
  assert.throws(() => checks.assertOrigins(inventory.findings.map((item) => item === row
    ? { ...item, physical_source: `supabase/migrations/${wrong[0]}` } : item), origins))
})
