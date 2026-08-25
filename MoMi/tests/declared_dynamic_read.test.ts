import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { findRuntimeAccessFindings } from
  "../scripts/constitution/find_runtime_access_findings.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("allows only a fully declared role-bound dynamic read routine", () => {
  const owner = service("analysis-owner")
  const consumer = service("analysis-consumer")
  const contract = "fixture.analysis.read.v1"
  const routine = "momi_analysis.execute_query_v1"
  owner.manifest.contracts.provides.push(contract)
  owner.manifest.owned_dataset!.private_routines = [routine]
  owner.manifest.owned_dataset!.public_reads = [contract]
  owner.manifest.owned_dataset!.public_routine_reads = [{ contract, routine }]
  owner.manifest.owned_dataset!.dynamic_read_routines = [{
    contract, routine, consumer_service: "analysis-consumer",
    role: "svc_analysis_consumer", schema: "momi_analysis",
  }]
  consumer.manifest.owned_dataset!.db_role = "svc_analysis_consumer"
  consumer.manifest.contracts.consumes = [{ service: "analysis-owner", contract }]
  const source = `create function ${routine}(p_sql text) returns jsonb
    language plpgsql security invoker
    set search_path = pg_catalog, momi_analysis as $$ begin
    if current_user <> 'svc_analysis_consumer'
      or current_setting('transaction_read_only') <> 'on' then raise exception 'stop'; end if;
    execute p_sql; return '{}'::jsonb; end; $$;`
  const module = { path: join(workspaceRoot, "database", "routines",
    `${routine}--fixture.sql`), service_key: "analysis-owner", source, imports: [] }
  assert.deepEqual(findRuntimeAccessFindings([owner, consumer], [module]), [])
  module.source = source.replace("transaction_read_only", "transaction_mode")
  assert.equal(findRuntimeAccessFindings([owner, consumer], [module])[0]?.rule_id,
    "dynamic_relation_identifier")
})
