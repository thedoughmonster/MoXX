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
