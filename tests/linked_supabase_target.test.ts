import assert from "node:assert/strict"
import test from "node:test"

import { assertLinkedSupabaseTarget } from
  "../scripts/release/assert_linked_supabase_target.ts"

const projectRef = "abcdefghijklmnopqrst"
const pooler = `postgresql://postgres.${projectRef}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`

test("accepts exact linked password-free session-pooler evidence", () => {
  assert.doesNotThrow(() => assertLinkedSupabaseTarget(
    projectRef,
    projectRef,
    pooler,
  ))
})

test("rejects unsafe or mismatched linked targets", () => {
  assert.throws(() => assertLinkedSupabaseTarget(
    projectRef,
    "tsrqponmlkjihgfedcba",
    pooler,
  ), /unexpected project/)
  const invalid = [
    pooler.replace(projectRef, "tsrqponmlkjihgfedcba"),
    pooler.replace("@aws-", ":secret@aws-"),
    pooler.replace(":5432/", ":6543/"),
    pooler.replace(".pooler.supabase.com", ".example.com"),
    pooler.replace("/postgres", "/other"),
    `${pooler}?sslmode=require`,
    `${pooler}#fragment`,
    pooler.replace("postgresql:", "http:"),
  ]
  for (const target of invalid) {
    assert.throws(() => assertLinkedSupabaseTarget(projectRef, projectRef, target))
  }
})
