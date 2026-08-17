import assert from "node:assert/strict"
import test from "node:test"

import { validateExecutionAuthority } from
  "../scripts/architecture/validate_execution_authority.ts"
import {
  context, positive, schema,
} from "./execution_authority_test_support.ts"

test("structured external trust rejects delimiter collisions", async () => {
  const grant = structuredClone(positive)
  grant.grant_id = "ea-mox-201-external-collision"
  grant.external.invoke = [{
    authority_key: "aa",
    operation: "bb:cc",
    resource: "dd",
  }]
  const scoped = structuredClone(context)
  scoped.externalAuthorities = [{
    authority_key: "aa:bb",
    operation: "cc",
    resource: "dd",
  }]
  const diagnostics = await validateExecutionAuthority(grant, schema, scoped)
  assert(diagnostics.some((item) =>
    item.code === "external_authority_missing"))
})

test("structured external deny lists do not collide", async () => {
  const grant = structuredClone(positive)
  grant.grant_id = "ea-mox-201-external-deny-collision"
  grant.external.invoke = [{
    authority_key: "aa",
    operation: "bb:cc",
    resource: "dd",
  }]
  grant.forbidden.external_actions = [{
    authority_key: "aa:bb",
    operation: "cc",
    resource: "dd",
  }]
  const scoped = structuredClone(context)
  scoped.externalAuthorities = structuredClone(grant.external.invoke)
  const diagnostics = await validateExecutionAuthority(grant, schema, scoped)
  assert(!diagnostics.some((item) => item.code === "allow_deny_overlap"))
})
