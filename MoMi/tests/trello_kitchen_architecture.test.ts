import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import type { ServiceManifest } from "../scripts/architecture/types.ts"
import { validateJson } from "../scripts/architecture/validate_json.ts"

const serviceSchema = await readJson<object>(join(
  workspaceRoot, "schemas", "service-manifest-v1.schema.json",
))
const functionSchema = await readJson<object>(join(
  workspaceRoot, "schemas", "function-manifest-v1.schema.json",
))

test("separates source, evidence ingestion, task ownership, and delivery", async () => {
  const acquisition = await readJson<ServiceManifest>(join(
    workspaceRoot, "services", "trello-data-acquisition", "service.json",
  ))
  const ingestion = await readJson<ServiceManifest>(join(
    workspaceRoot, "services", "trello-evidence-ingestion", "service.json",
  ))
  const tasks = await readJson<ServiceManifest>(join(
    workspaceRoot, "services", "kitchen-task-management", "service.json",
  ))
  const delivery = await readJson<ServiceManifest>(join(
    workspaceRoot, "services", "trello-task-delivery", "service.json",
  ))
  for (const manifest of [acquisition, ingestion, tasks, delivery]) {
    validateJson(serviceSchema, manifest, manifest.service_key)
  }
  assert.equal(acquisition.service_type, "procurement_adapter")
  assert.equal(ingestion.service_type, "transform")
  assert.equal(tasks.service_type, "dataset_owner")
  assert.equal(delivery.service_type, "destination_adapter")
  assert.deepEqual(acquisition.network.outbound_hosts, ["api.trello.com"])
  assert.deepEqual(tasks.network.outbound_hosts, [])
})

test("keeps procurement isolated and routes archive capture through ingestion", async () => {
  const acquisition = await readJson<ServiceManifest>(join(
    workspaceRoot, "services", "trello-data-acquisition", "service.json",
  ))
  const ingestion = await readJson<ServiceManifest>(join(
    workspaceRoot, "services", "trello-evidence-ingestion", "service.json",
  ))
  assert.deepEqual(acquisition.contracts.consumes, [])
  assert.deepEqual(ingestion.contracts.consumes, [
    { service: "communications-archive", contract: "momi.raw_json.capture_evidence.v1" },
    { service: "trello-data-acquisition", contract: "trello.data.acquisition.request.v1" },
  ])
  assert(!acquisition.secrets.includes("TRELLO_WEBHOOK_SECRET"))
  assert(ingestion.secrets.includes("TRELLO_WEBHOOK_SECRET"))
  const archive = await readJson<ServiceManifest>(join(
    workspaceRoot, "services", "communications-archive", "service.json",
  ))
  assert(archive.owned_dataset!.public_commands.includes(
    "momi.raw_json.capture_evidence.v1",
  ))
  assert(!archive.contracts.provides.includes("momi.raw_json.read_evidence.v1"))
})

test("keeps kitchen contracts declared, reserved, and unbound", async () => {
  const tasks = await readJson<ServiceManifest>(join(
    workspaceRoot, "services", "kitchen-task-management", "service.json",
  ))
  const readme = await readFile(join(
    workspaceRoot, "services", "kitchen-task-management", "README.md",
  ), "utf8")

  assert.equal(tasks.implementation_status, "declared")
  assert.deepEqual(tasks.functions, [])
  assert.deepEqual(tasks.contracts.provides, [
    "momi.kitchen_tasks.command.v1",
    "momi.kitchen_tasks.consume_trello_evidence.v1",
  ])
  assert.deepEqual(tasks.deployment.owns, [])
  assert.deepEqual(tasks.owned_dataset?.private_relations, [])
  assert.deepEqual(tasks.owned_dataset?.private_routines, [])
  assert.deepEqual(tasks.owned_dataset?.public_reads, [])
  assert.deepEqual(tasks.owned_dataset?.public_commands, tasks.contracts.provides)
  assert.deepEqual(tasks.owned_dataset?.emitted_events, ["kitchen.task.changed"])
  assert.match(readme, /momi\.kitchen_tasks\.command\.v1/u)
  assert.match(readme, /momi\.kitchen_tasks\.consume_trello_evidence\.v1/u)
  assert.match(readme, /kitchen\.task\.changed/u)
  assert.match(readme, /reserved and unbound/u)
  assert.match(readme, /non-callable/u)
  assert.match(readme, /no runtime emission is asserted/u)
  assert.match(readme, /not evidence that database objects exist/u)
})

test("accepts explicit Trello inbound and outbound function boundaries", () => {
  const fixture = (boundary: string, owner_service: string) => ({
    function_key: "trello.fixture.operation.v1",
    contract_version: 1,
    purpose: "Validate one explicit Trello provider boundary.",
    owner_service,
    function_type: "ingest",
    capability: "ingest",
    boundary,
    runtime: "supabase_edge",
    route_path: "/functions/v1/trello-fixture-v1",
    authentication_policy_key: "trello.webhook.signature.v1",
    entrypoint: "index.ts",
    input_schema: "contracts/input.schema.json",
    output_schema: "contracts/output.schema.json",
    required_capabilities: [],
    declared_side_effects: [],
  })
  validateJson(functionSchema, fixture(
    "trello_inbound", "trello-evidence-ingestion",
  ), "trello inbound")
  validateJson(functionSchema, fixture(
    "trello_outbound", "trello-data-acquisition",
  ), "trello outbound")
})

test("keeps canonical task identity and activation gates explicit", async () => {
  const decision = await readFile(join(
    workspaceRoot, "docs", "decisions", "0025-trello-kitchen-task-integration.md",
  ), "utf8")
  const normalized = decision.replaceAll(/\s+/g, " ")
  assert.match(normalized, /MoMi UUIDs are canonical/)
  assert.match(normalized, /action\.id.*idempotency key/)
  assert.match(normalized, /does not mutate the board without a separately approved activation/)
  assert.match(normalized, /never stored in Git, issue text, logs, audit payloads, or task prompts/)
})
