import assert from "node:assert/strict"
import { test } from "node:test"

import { VALID_DEADMAN_INPUT } from "./deadman_command.test_fixture.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import { generateGuardBootstrapSql } from "./generate_guard_bootstrap_sql.ts"
import { DATABASE_GUARD_LEASE_CONTRACT } from "./guard_lease_contract.ts"
import { VALID_GUARD_BOOTSTRAP_INPUT } from "./guard_bootstrap.test_fixture.ts"

test("database lifecycle uses the exact guard lease and transaction locks only", () => {
  assert.deepEqual(DATABASE_GUARD_LEASE_CONTRACT, {
    lifecycleFence: "exact_guard_generation_and_database_expiry",
    mutationLock: "transaction_scoped_advisory_lock",
    persistentSessionLock: false,
    activationAllowed: false,
    activationPrerequisite:
      "issue_330_activation_inside_exact_current_guard_fence_and_orchestration",
  })
  const sql = `${generateDeadmanCommand(VALID_DEADMAN_INPUT)}\n` +
    generateGuardBootstrapSql(VALID_GUARD_BOOTSTRAP_INPUT)
  assert.match(sql, /pg_(?:try_)?advisory_xact_lock/)
  assert.doesNotMatch(sql, /pg_(?:try_)?advisory_lock\s*\(/)
  assert.doesNotMatch(sql, /active\s*:=\s*true/)
})
