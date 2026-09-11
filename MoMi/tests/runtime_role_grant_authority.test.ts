import assert from "node:assert/strict"
import test from "node:test"
import { findRoleAuthorityChanges } from "../scripts/migrations/find_role_authority_changes.ts"

test("runtime role grants require the exact owner declaration and restricted options", () => {
  const grant = "grant svc_records_owner to postgres with inherit false, set true;"
  assert.ok(findRoleAuthorityChanges(grant, "svc_records_owner").length)
  assert.deepEqual(findRoleAuthorityChanges(grant, "svc_records_owner", [], "postgres"), [])
  assert.deepEqual(findRoleAuthorityChanges(
    grant.replace("set true", "set false"), "svc_records_owner", [], "postgres"), [])
  for (const forbidden of [
    grant.replace("svc_records_owner", "svc_another_owner"),
    grant.replace("to postgres", "to authenticated"),
    grant.replace("inherit false", "inherit true"),
    grant.replace(", set true", ", set true, admin true"),
    "grant svc_records_owner to postgres;",
    "set role svc_records_owner;",
    "alter role svc_records_owner login;",
    grant + " grant svc_another_owner to postgres;",
    "grant svc_records_owner to postgres with inherit false, set true; alter table private.records owner to svc_records_owner;",
  ]) {
    assert.ok(findRoleAuthorityChanges(forbidden, "svc_records_owner", [], "postgres").length,
      forbidden)
  }
  assert.ok(findRoleAuthorityChanges(grant, undefined, [], "postgres").length)
})
