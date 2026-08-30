import assert from "node:assert/strict"
import test from "node:test"

import { assertSupabasePreflightAuthority } from
  "../scripts/assert-supabase-preflight-authority.mjs"

const valid = {
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/prod",
  GITHUB_REPOSITORY: "thedoughmonster/MoXX",
  GITHUB_WORKFLOW_REF:
    "thedoughmonster/MoXX/.github/workflows/supabase-credential-preflight.yml@refs/heads/prod",
  MOXX_TARGET_ENVIRONMENT: "prod",
}

test("accepts only the exact matching preflight authority", () => {
  assert.doesNotThrow(() => assertSupabasePreflightAuthority(valid))
  assert.doesNotThrow(() => assertSupabasePreflightAuthority({
    ...valid,
    GITHUB_REF: "refs/heads/dev",
    GITHUB_WORKFLOW_REF:
      "thedoughmonster/MoXX/.github/workflows/supabase-credential-preflight.yml@refs/heads/dev",
    MOXX_TARGET_ENVIRONMENT: "dev",
  }))
})

test("rejects alternate repositories, events, refs, and workflows", () => {
  const invalid = [
    { ...valid, GITHUB_REPOSITORY: "thedoughmonster/MoXX-fork" },
    { ...valid, GITHUB_EVENT_NAME: "push" },
    { ...valid, GITHUB_REF: "refs/heads/dev" },
    { ...valid, GITHUB_WORKFLOW_REF:
      "thedoughmonster/MoXX/.github/workflows/deploy-prod.yml@refs/heads/prod" },
    { ...valid, MOXX_TARGET_ENVIRONMENT: "staging" },
  ]
  for (const runtime of invalid) {
    assert.throws(() => assertSupabasePreflightAuthority(runtime))
  }
})
