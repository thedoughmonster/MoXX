import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { findRuntimeAccessFindings } from
  "../scripts/constitution/find_runtime_access_findings.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

const insert = (expression: string) =>
  `insert into momi_events.events (event_name, idempotency_key) ` +
  `values (${expression}, 'fixture');`

test("requires an exact declaration for a literal emitted event", () => {
  const owner = service("records-owner")
  const module = {
    path: join(owner.directory, "emit.sql"),
    service_key: owner.manifest.service_key,
    source: insert("'warehouse.fixture.observed'"),
    imports: [],
  }
  let rules = findRuntimeAccessFindings([owner], [module])
    .map((finding) => finding.rule_id)
  assert.ok(rules.includes("undeclared_event_emission"))
  owner.manifest.owned_dataset!.emitted_events = ["warehouse.fixture.observed"]
  rules = findRuntimeAccessFindings([owner], [module])
    .map((finding) => finding.rule_id)
  assert.ok(!rules.includes("undeclared_event_emission"))
})

test("ratchets an existing dynamic event identity", () => {
  const owner = service("records-owner")
  const findings = findRuntimeAccessFindings([owner], [{
    path: join(owner.directory, "emit.sql"),
    service_key: owner.manifest.service_key,
    source: insert("'warehouse.fixture.' || event_kind"),
    imports: [],
  }])
  assert.ok(findings.some((finding) => finding.rule_id === "dynamic_event_name"))
})
