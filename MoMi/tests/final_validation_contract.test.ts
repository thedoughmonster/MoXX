import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("final gate routes all Git authority through immutable child identities", async () => {
  const [entry, architecture, production, runner] = await Promise.all([
    readFile("scripts/run_check_changed.ts", "utf8"),
    readFile("scripts/check_architecture.ts", "utf8"),
    readFile("scripts/migrations/load_production_migrations.ts", "utf8"),
    readFile("scripts/dev_loop/run_validation.ts", "utf8"),
  ])
  assert.match(entry, /buildBoundPlan\([\s\S]+!final/u)
  assert.match(entry, /MOMI_VALIDATION_BASE_SHA: plan\.base\.sha/u)
  assert.match(entry, /MOMI_VALIDATION_HEAD_SHA: plan\.head\.sha/u)
  assert.match(entry, /MOMI_PROD_REF: finalState\.production\.sha/u)
  assert.match(entry, /evidence_scope: final \? "exact_committed_head"/u)
  assert.match(entry, /Focused non-final validation/u)
  assert.match(architecture, /MOMI_VALIDATION_BASE_SHA[\s\S]+MOMI_VALIDATION_HEAD_SHA/u)
  assert.match(production, /origin\/prod or a full commit SHA/u)
  assert.match(runner, /assert_invariants/u)
})
