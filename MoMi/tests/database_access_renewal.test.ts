import assert from "node:assert/strict"
import test from "node:test"

import { buildJitRenewal } from "../scripts/database_access/build_jit_renewal.ts"

test("renews postgres access while preserving its restrictions", () => {
  const renewal = buildJitRenewal({
    user_id: "55d09c22-c9fe-4e94-9473-1e34a26be52a",
    user_roles: [{
      role: "postgres",
      expires_at: 1,
      branches_only: false,
      allowed_networks: { allowed_cidrs: [{ cidr: "203.0.113.0/24" }] },
    }],
  }, 1_800_000_000)

  assert.equal(renewal.expires_at, 1_807_689_600)
  assert.deepEqual(renewal.payload.roles[0], {
    role: "postgres",
    expires_at: 1_807_689_600,
    branches_only: false,
    allowed_networks: { allowed_cidrs: [{ cidr: "203.0.113.0/24" }] },
  })
})

test("rejects a mapping without postgres access", () => {
  assert.throws(() => buildJitRenewal({
    user_id: "55d09c22-c9fe-4e94-9473-1e34a26be52a",
    user_roles: [{ role: "readonly" }],
  }, 1_800_000_000), /postgres role/)
})
