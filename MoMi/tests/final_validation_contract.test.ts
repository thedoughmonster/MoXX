import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("final gate routes all Git authority through immutable child identities", async () => {
  const [entry, architecture, production, history, runner, planBuilder,
    checkout, lock] =
    await Promise.all([
    readFile("scripts/run_check_changed.ts", "utf8"),
    readFile("scripts/check_architecture.ts", "utf8"),
    readFile("scripts/migrations/load_production_migrations.ts", "utf8"),
    readFile("scripts/migrations/load_development_migration_changes.ts", "utf8"),
    readFile("scripts/dev_loop/run_validation.ts", "utf8"),
    readFile("scripts/dev_loop/build_bound_plan_from_checkout.ts", "utf8"),
    readFile("scripts/dev_loop/create_final_validation_checkout.ts", "utf8"),
    readFile("scripts/dev_loop/set_final_validation_checkout_writable.ts", "utf8"),
  ])
  assert.match(entry, /await buildBoundPlan\(base, head, true\)/u)
  assert.match(entry, /buildBoundPlanFromCheckout/u)
  assert.match(planBuilder, /"--committed"/u)
  assert.match(entry, /MOMI_VALIDATION_BASE_SHA: source\.base\.sha/u)
  assert.match(entry, /MOMI_VALIDATION_HEAD_SHA: source\.head\.sha/u)
  assert.match(entry, /MOMI_PROD_REF: source\.production\.sha/u)
  assert.match(entry, /MOMI_DEV_REF: source\.development\.sha/u)
  assert.doesNotMatch(entry, /MOMI_DEV_REF:[\s\S]+process\.env\.MOMI_DEV_REF/u)
  assert.match(entry, /workspace_root: checkout\.workspace_root/u)
  assert.match(entry, /evidence_scope: final \? "exact_committed_head"/u)
  assert.match(entry, /Focused non-final validation/u)
  assert.match(architecture, /MOMI_VALIDATION_BASE_SHA[\s\S]+MOMI_VALIDATION_HEAD_SHA/u)
  assert.match(production, /origin\/prod or a full commit SHA/u)
  assert.match(history, /MOMI_PROD_REF[\s\S]+productSourceCommit\(productionRef\)/u)
  assert.match(runner, /assert_invariants/u)
  assert.match(checkout, /"worktree", "add", "--detach"/u)
  assert.match(lock, /0o555[\s\S]+0o444/u)
})
