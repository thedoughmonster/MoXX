import assert from "node:assert/strict"
import test from "node:test"

import { findExecutionAuthorityIdentityViolations } from
  "../scripts/architecture/find_execution_authority_identity_violations.ts"
import { loadExecutionAuthorityDebtTargets } from
  "../scripts/architecture/load_execution_authority_debt_targets.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { validateExecutionAuthority } from
  "../scripts/architecture/validate_execution_authority.ts"
import { context, positive, schema } from
  "./execution_authority_test_support.ts"

test("indexes canonical database debt and rejects it as authority", async () => {
  const debtTargets = await loadExecutionAuthorityDebtTargets(workspaceRoot)
  assert(debtTargets.includes("momi_warehouse.entity_versions"))
  assert(debtTargets.includes("toast_acquisition.enqueue_menu_publication"))
  assert(!debtTargets.includes("emitted_event_name"))
  const grant = structuredClone(positive)
  grant.grant_id = "ea-mox-201-debt"
  grant.database.read[0].qualified_object = "momi_warehouse.entity_versions"
  const scoped = structuredClone(context)
  scoped.services["preorder-operations"].database.read.push("momi_warehouse")
  scoped.debtTargets = debtTargets
  const diagnostics = await validateExecutionAuthority(grant, schema, scoped)
  assert(diagnostics.some((item) =>
    item.code === "debt_derived_authority" &&
    item.field_path === "/database/read/0"))
})

test("rejects duplicate grant and issue-scope identities", () => {
  const first = structuredClone(positive)
  const second = structuredClone(positive)
  second.work_item = "MOX-202"
  const sameGrant = findExecutionAuthorityIdentityViolations([
    { label: "execution-authorities/a.json", grant: first },
    { label: "execution-authorities/b.json", grant: second },
  ])
  assert.deepEqual(sameGrant, [
    "execution-authorities/a.json/grant_id: ambiguous_authority: " +
      "ea-mox-201-positive",
    "execution-authorities/b.json/grant_id: ambiguous_authority: " +
      "ea-mox-201-positive",
  ])
  second.grant_id = "ea-mox-201-second"
  second.work_item = first.work_item
  const sameScope = findExecutionAuthorityIdentityViolations([
    { label: "execution-authorities/a.json", grant: first },
    { label: "execution-authorities/b.json", grant: second },
  ])
  assert.deepEqual(sameScope, [
    "execution-authorities/a.json/work_item: ambiguous_authority: " +
      "thedoughmonster/momi-backend:MOX-201",
    "execution-authorities/b.json/work_item: ambiguous_authority: " +
      "thedoughmonster/momi-backend:MOX-201",
  ])
  second.work_item = "MOX-202"
  assert.deepEqual(findExecutionAuthorityIdentityViolations([
    { label: "execution-authorities/a.json", grant: first },
    { label: "execution-authorities/b.json", grant: second },
  ]), [])
})
