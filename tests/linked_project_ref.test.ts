import assert from "node:assert/strict"
import test from "node:test"

import { assertLinkedProjectRef } from
  "../scripts/release/assert_linked_project_ref.ts"

const projectRef = "abcdefghijklmnopqrst"

test("accepts the exact linked project ref", () => {
  assert.doesNotThrow(() => assertLinkedProjectRef(projectRef, projectRef))
})

test("rejects empty or mismatched linked project refs", () => {
  assert.throws(() => assertLinkedProjectRef(projectRef, ""))
  assert.throws(() =>
    assertLinkedProjectRef(projectRef, "tsrqponmlkjihgfedcba")
  )
})
