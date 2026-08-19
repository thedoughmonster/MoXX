import assert from "node:assert/strict"
import test from "node:test"

import { buildDatabaseObjectAuthority } from
  "../scripts/architecture/build_database_object_authority.ts"
import { digestDatabaseObjectAuthority } from
  "../scripts/architecture/digest_database_object_authority.ts"
import { renderDatabaseObjectAuthority } from
  "../scripts/architecture/render_database_object_authority.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import { validateDatabaseObjectAuthority } from
  "../scripts/architecture/validate_database_object_authority.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"

test("generates a validated exact-object model from identical Git objects", async () => {
  const first = buildDatabaseObjectAuthority(workspaceRoot, "HEAD")
  const second = buildDatabaseObjectAuthority(workspaceRoot, "HEAD^{commit}")
  const schema = await readJson<object>(
    `${workspaceRoot}/schemas/database-object-authority-v1.schema.json`,
  )
  assert.deepEqual(first.diagnostics, [])
  assert.deepEqual(validateDatabaseObjectAuthority(first.authority, schema), [])
  assert.equal(renderDatabaseObjectAuthority(first.authority),
    renderDatabaseObjectAuthority(second.authority))
  assert.equal(first.authority.source_digest, second.authority.source_digest)
  assert.equal(first.authority.authority_digest, second.authority.authority_digest)
})

test("keeps the five authority layers disjoint and exact", () => {
  const { authority } = buildDatabaseObjectAuthority(workspaceRoot, "HEAD")
  const broad = authority.runtime_compatibility.filter((item) =>
    item.scope.kind === "historical_broad_migration_debt")
  const exact = authority.runtime_compatibility.filter((item) =>
    item.scope.kind === "exact_object")
  assert.equal(broad.length, 83)
  assert.equal(exact.length, 3)
  assert(authority.objects.every((item) => item.identity.class !== "sequence"))
  assert(!authority.objects.some((item) =>
    item.identity.schema === "cron" && item.identity.name === "job_run_details"))
  assert(exact.some((item) => item.scope.kind === "exact_object" &&
    item.scope.object.class === "relation" && item.scope.object.schema === "cron"))
  assert(authority.migration_ownership.every((item) =>
    item.mode === "migration.own" && !Object.hasOwn(item, "capability")))
  assert.equal(authority.legacy_debt_reference.path,
    "docs/service-access-debt-baseline.json")
})

test("an exact relation identity does not imply a schema sibling", () => {
  const { authority } = buildDatabaseObjectAuthority(workspaceRoot, "HEAD")
  const relation = authority.objects.find((item) =>
    item.identity.class === "relation" &&
    item.owner_service === "preorder-operations")!
  const sameSchema = authority.objects.filter((item) =>
    item.identity.schema === relation.identity.schema)
  assert(sameSchema.length > 1)
  assert.equal(authority.objects.filter((item) =>
    JSON.stringify(item.identity) === JSON.stringify(relation.identity)).length, 1)
})

test("rejects digest drift and alternate reordered authority digests", async () => {
  const schema = await readJson<object>(
    `${workspaceRoot}/schemas/database-object-authority-v1.schema.json`,
  )
  const generated = buildDatabaseObjectAuthority(workspaceRoot, "HEAD").authority
  const drifted = structuredClone(generated)
  drifted.authority_digest = "0".repeat(64)
  assert(validateDatabaseObjectAuthority(drifted, schema).some((item) =>
    item.code === "source_digest_drift"))
  const reordered = structuredClone(generated)
  reordered.objects.reverse()
  reordered.authority_digest = digestDatabaseObjectAuthority(reordered)
  const diagnostics = validateDatabaseObjectAuthority(reordered, schema)
  assert(diagnostics.some((item) => item.code === "schema_invalid" &&
    item.json_pointer === "/objects"))
})
