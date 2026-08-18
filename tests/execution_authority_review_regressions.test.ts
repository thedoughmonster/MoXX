import assert from "node:assert/strict"
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { buildExecutionAuthorityDatabaseOwners } from
  "../scripts/architecture/build_execution_authority_database_owners.ts"
import { discoverServices } from
  "../scripts/architecture/discover_services.ts"
import { findExecutionAuthorityViolations } from
  "../scripts/architecture/find_execution_authority_violations.ts"
import type { ExecutionAuthority } from
  "../scripts/architecture/execution_authority_types.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import { validateExecutionAuthority } from
  "../scripts/architecture/validate_execution_authority.ts"
import {
  context, fixtureRoot, positive, schema,
} from "./execution_authority_test_support.ts"

test("canonical archive objects reject preorder as a false owner", async () => {
  const services = await discoverServices("services")
  const owners = buildExecutionAuthorityDatabaseOwners(services)
  assert.deepEqual(
    owners.relations["momi_communications.archive_items"],
    ["communications-archive"],
  )
  assert.deepEqual(
    owners.routines["momi_communications.capture_raw_json_evidence_v1"],
    ["communications-archive"],
  )
  for (const [object_kind, qualified_object] of [
    ["table", "momi_communications.archive_items"],
    ["routine", "momi_communications.capture_raw_json_evidence_v1"],
  ] as const) {
    const grant = structuredClone(positive)
    grant.grant_id = `ea-mox-239-false-owner-${object_kind}`
    grant.database.write[0] = {
      owner_service: "preorder-operations", object_kind, qualified_object,
    }
    const scoped = structuredClone(context)
    scoped.services["preorder-operations"].database.write.push(
      "momi_communications",
    )
    scoped.databaseOwners = owners
    const diagnostics = await validateExecutionAuthority(grant, schema, scoped)
    assert(diagnostics.some((item) => item.code === "cross_owner_target" &&
      item.field_path === "/database/write/0/owner_service"))
  }
})

test("schema-wide grants cannot contain exact debt targets", async () => {
  const grant = structuredClone(positive)
  grant.grant_id = "ea-mox-201-schema-debt"
  grant.database.read[0] = {
    owner_service: "preorder-operations",
    object_kind: "schema",
    qualified_object: "momi_orders",
  }
  const scoped = structuredClone(context)
  scoped.debtTargets.push("momi_orders.debt_relation")
  const diagnostics = await validateExecutionAuthority(grant, schema, scoped)
  assert(diagnostics.some((item) =>
    item.code === "debt_derived_authority" &&
    item.target === "momi_orders.debt_relation"))
})

test("repository scanner requires issue-scoped trust", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "momi-authority-scan-"))
  t.after(async () => await rm(root, { recursive: true, force: true }))
  await mkdir(join(root, "execution-authorities"), { recursive: true })
  await mkdir(join(root, "schemas"), { recursive: true })
  await mkdir(join(root, "docs"), { recursive: true })
  for (const path of [
    "schemas/execution-authority-v1.schema.json",
    "schemas/service-access-debt-baseline-v1.schema.json",
    "docs/service-access-debt-baseline.json",
  ]) await cp(path, join(root, path))
  const zero = await readJson<ExecutionAuthority>(
    join(fixtureRoot, "zero-authority.json"),
  )
  const external = structuredClone(zero)
  external.grant_id = "ea-mox-202-external"
  external.work_item = "MOX-202"
  external.provenance.issue_authorization.source = "linear:MOX-202"
  external.external.invoke = structuredClone(positive.external.invoke)
  await writeFile(join(root, "execution-authorities", "zero.json"),
    JSON.stringify(zero))
  await writeFile(join(root, "execution-authorities", "external.json"),
    JSON.stringify(external))
  const services = await discoverServices("services")
  const externalKey = {
    authority_key: "github.contents",
    operation: "read",
    resource: "thedoughmonster/momi-backend",
  }
  const trust = {
    grants: {
      "MOX-201": {
        baseRevision: zero.base_revision,
        sourceDigest: zero.source_digest,
        externalAuthorities: [],
      },
      "MOX-202": {
        baseRevision: external.base_revision,
        sourceDigest: external.source_digest,
        externalAuthorities: [externalKey],
      },
    },
  }
  assert.deepEqual(
    await findExecutionAuthorityViolations(services, root, trust), [],
  )
  const crossed = structuredClone(trust)
  crossed.grants["MOX-201"].externalAuthorities = [externalKey]
  crossed.grants["MOX-202"].externalAuthorities = []
  assert((await findExecutionAuthorityViolations(services, root, crossed))
    .some((item) => item.includes("external_authority_missing")))
  const untrusted = await findExecutionAuthorityViolations(services, root)
  assert(untrusted.some((item) => item.includes("base_revision_drift")))
  assert(untrusted.some((item) => item.includes("source_digest_drift")))
  assert(untrusted.some((item) => item.includes("external_authority_missing")))
})
