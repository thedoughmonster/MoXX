import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import type { ExecutionAuthority } from
  "../scripts/architecture/execution_authority_types.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import { validateExecutionAuthority } from
  "../scripts/architecture/validate_execution_authority.ts"
import { context, fixtureRoot, positive, schema } from
  "./execution_authority_test_support.ts"

async function diagnosticsFor(
  change: (grant: ExecutionAuthority) => void,
) {
  const grant = structuredClone(positive)
  change(grant)
  return await validateExecutionAuthority(grant, schema, context)
}

test("binds git and SHA-256 identity lengths exactly", async () => {
  const cases: Array<[
    string,
    (grant: ExecutionAuthority) => void,
  ]> = [
    ["/base_revision", (grant) => {
      grant.base_revision = "0".repeat(64)
    }],
    ["/source_digest", (grant) => {
      grant.source_digest = "a".repeat(40)
    }],
    ["/provenance/issue_authorization/digest", (grant) => {
      grant.provenance.issue_authorization.digest = "b".repeat(40)
    }],
  ]
  for (const [field, change] of cases) {
    const diagnostics = await diagnosticsFor(change)
    assert(diagnostics.some((item) =>
      item.code === "schema_invalid" && item.field_path === field))
  }
})

test("requires category-relevant provenance and repository rules", async () => {
  const cases: Array<[
    string,
    (grant: ExecutionAuthority) => void,
  ]> = [
    ["manifests", (grant) => {
      grant.provenance.manifests = []
    }],
    ["contracts", (grant) => {
      grant.provenance.contracts = []
    }],
    ["external_authorities", (grant) => {
      grant.provenance.external_authorities = []
    }],
    ["repository_rules", (grant) => {
      grant.provenance.repository_rules = []
    }],
  ]
  for (const [target, change] of cases) {
    const diagnostics = await diagnosticsFor(change)
    assert(diagnostics.some((item) =>
      item.code === "provenance_missing" && item.target === target))
  }
  const zero = await readJson<ExecutionAuthority>(
    join(fixtureRoot, "zero-authority.json"),
  )
  zero.provenance.manifests = []
  zero.provenance.contracts = []
  zero.provenance.external_authorities = []
  assert(!(await validateExecutionAuthority(zero, schema, context)).some(
    (item) => item.code === "provenance_missing"))
})

test("deny containment covers paths and database schemas only", async () => {
  const blocked = await diagnosticsFor((grant) => {
    grant.forbidden.paths = [
      ".env", "docs/contracts", "supabase/migrations",
    ]
    grant.forbidden.database_objects = [
      "momi_orders", "other.private_table",
    ]
  })
  assert(blocked.some((item) =>
    item.code === "allow_deny_overlap" &&
    item.target === "docs/contracts/execution-authority-v1.md"))
  assert(blocked.some((item) =>
    item.code === "allow_deny_overlap" &&
    item.target === "momi_orders.order_headers"))
  const sibling = await diagnosticsFor((grant) => {
    grant.forbidden.paths = [
      ".env", "docs/contracting", "supabase/migrations",
    ]
    grant.forbidden.database_objects = [
      "momi_order", "other.private_table",
    ]
  })
  assert(!sibling.some((item) => item.code === "allow_deny_overlap"))
})
