import assert from "node:assert/strict"
import { rm } from "node:fs/promises"
import test from "node:test"

import { findFunctionInventoryViolations } from
  "../scripts/architecture/find_function_inventory_violations.ts"
import { createFunctionInventoryFixture } from "./function_inventory_fixture.ts"

test("accepts an exact manifest, source, adapter, and config inventory", async (t) => {
  const fixture = await createFunctionInventoryFixture()
  t.after(async () => await rm(fixture.root, { recursive: true, force: true }))
  assert.deepEqual(
    await findFunctionInventoryViolations(
      fixture.workspace,
      fixture.services,
      fixture.root,
    ),
    [],
  )
})

test("rejects an undeclared service function directory", async (t) => {
  const fixture = await createFunctionInventoryFixture("service")
  t.after(async () => await rm(fixture.root, { recursive: true, force: true }))
  const violations = await findFunctionInventoryViolations(
    fixture.workspace,
    fixture.services,
    fixture.root,
  )
  assert.deepEqual(violations, [
    "services/fixture-service/functions/orphan-function-v1: not declared by fixture-service/service.json",
  ])
})

test("rejects an undeclared Supabase adapter", async (t) => {
  const fixture = await createFunctionInventoryFixture("adapter")
  t.after(async () => await rm(fixture.root, { recursive: true, force: true }))
  const violations = await findFunctionInventoryViolations(
    fixture.workspace,
    fixture.services,
    fixture.root,
  )
  assert.deepEqual(violations, [
    "supabase/functions/orphan-function-v1: not declared by a service manifest",
  ])
})

test("rejects an undeclared config section without verify_jwt", async (t) => {
  const fixture = await createFunctionInventoryFixture("config")
  t.after(async () => await rm(fixture.root, { recursive: true, force: true }))
  const violations = await findFunctionInventoryViolations(
    fixture.workspace,
    fixture.services,
    fixture.root,
  )
  assert.deepEqual(violations, [
    "supabase/config.toml [functions.orphan-function-v1]: not declared by a service manifest",
  ])
})
