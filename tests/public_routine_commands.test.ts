import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import type { SourceModule } from "../scripts/architecture/types.ts"
import { findPublicRoutineCommandFindings } from
  "../scripts/constitution/find_public_routine_command_findings.ts"
import { findPublicRelationReadFindings } from
  "../scripts/constitution/find_public_relation_read_findings.ts"
import { findRuntimeRoutineFindings } from
  "../scripts/constitution/find_runtime_routine_findings.ts"
import { findNewMigrationAuthorityViolations } from
  "../scripts/migrations/find_new_migration_authority_violations.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("requires an owned declared public routine command", () => {
  const owner = service("records-owner")
  owner.manifest.owned_dataset!.public_routine_commands = [{
    contract: "fixture.unknown.command.v1",
    routine: "other_schema.mutate",
  }]
  assert.deepEqual(
    findPublicRoutineCommandFindings([owner]).map((item) => item.rule_id),
    [
      "public_routine_command_contract_missing",
      "public_routine_command_not_owned",
    ],
  )
})

test("allows only an exact consumed private-schema routine command", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  const contract = "fixture.records.command.v1"
  owner.manifest.contracts.provides.push(contract)
  owner.manifest.owned_dataset!.public_commands = [contract]
  owner.manifest.owned_dataset!.public_routine_commands = [{
    contract,
    routine: "fixture_records.mutate",
  }]
  delete owner.manifest.owned_dataset!.private_schema
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  consumer.manifest.contracts.consumes = [{
    service: "records-owner",
    contract,
  }]
  assert.deepEqual(findPublicRoutineCommandFindings([owner]), [])
  const module: SourceModule = {
    path: join(consumer.directory, "src", "command.ts"),
    service_key: consumer.manifest.service_key,
    source: "sql`select fixture_records.mutate(1)`",
    imports: [],
  }
  assert.deepEqual(findRuntimeRoutineFindings([owner, consumer], [module]), [])
  module.source = 'sql`select "fixture_records" . "mutate"(1)`'
  assert.deepEqual(findRuntimeRoutineFindings([owner, consumer], [module]), [])
  module.source = "sql`drop function fixture_records.mutate`"
  assert.equal(
    findRuntimeRoutineFindings([owner, consumer], [module])[0].rule_id,
    "direct_private_routine_mutation",
  )
  module.source = "sql`select fixture_records.private_mutate(1)`"
  assert.equal(
    findRuntimeRoutineFindings([owner, consumer], [module])[0].rule_id,
    "unowned_private_routine_call",
  )
})

test("applies exact routine contracts to new migrations", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  const contract = "fixture.records.command.v1"
  owner.manifest.contracts.provides.push(contract)
  owner.manifest.owned_dataset!.public_commands = [contract]
  owner.manifest.owned_dataset!.public_routine_commands = [{
    contract,
    routine: "fixture_records.mutate",
  }]
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  consumer.manifest.contracts.consumes = [{
    service: "records-owner",
    contract,
  }]
  const header = "-- service-owner: records-consumer\n"
  assert.deepEqual(findNewMigrationAuthorityViolations(
    new Map(),
    new Map([["001.sql", header + "select fixture_records.mutate(1);"]]),
    [owner, consumer],
  ), [])
  assert.equal(findNewMigrationAuthorityViolations(
    new Map(),
    new Map([["001.sql", header + "select fixture_records.private_mutate(1);"]]),
    [owner, consumer],
  ).length, 1)
})

test("requires every public read to name an exact artifact", () => {
  const owner = service("records-owner")
  const contract = "fixture.records.read.v1"
  owner.manifest.owned_dataset!.public_routine_reads = []
  assert.match(
    findPublicRelationReadFindings([owner]).map((item) => item.rule_id).join("\n"),
    /public_read_artifact_missing/,
  )
  owner.manifest.owned_dataset!.public_routine_reads = [{
    contract,
    routine: "fixture_records.mutate",
  }]
  assert.deepEqual(findPublicRelationReadFindings([owner]), [])
  assert.deepEqual(findPublicRoutineCommandFindings([owner]), [])
})
