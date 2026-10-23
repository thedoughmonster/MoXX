import assert from "node:assert/strict"
import test from "node:test"

import {
  evaluateProductValidation,
  PRODUCT_VALIDATION_CONTEXT,
} from "../scripts/product-validation-gate.mjs"

const base = {
  routingResult: "success",
  momiSelected: "false",
  momiResult: "skipped",
  moxiSelected: "false",
  moxiResult: "skipped",
}

test("uses the one stable branch-protection context", () => {
  assert.equal(PRODUCT_VALIDATION_CONTEXT, "product-validation")
})

test("passes a backend-only PR only when backend validation succeeds", () => {
  assert.deepEqual(
    evaluateProductValidation({
      ...base,
      momiSelected: "true",
      momiResult: "success",
    }),
    { ok: true, message: "MoMi validation succeeded" },
  )
})

test("reproduces PR #7: routing success cannot mask backend failure", () => {
  assert.deepEqual(
    evaluateProductValidation({
      ...base,
      momiSelected: "true",
      momiResult: "failure",
    }),
    { ok: false, message: "MoMi result is failure" },
  )
})

test("passes a UI-only PR only when UI validation succeeds", () => {
  assert.equal(
    evaluateProductValidation({
      ...base,
      moxiSelected: "true",
      moxiResult: "success",
    }).ok,
    true,
  )
  assert.equal(
    evaluateProductValidation({
      ...base,
      moxiSelected: "true",
      moxiResult: "failure",
    }).ok,
    false,
  )
})

test("passes a root-only PR after routing selects no product", () => {
  assert.deepEqual(evaluateProductValidation(base), {
    ok: true,
    message: "routing selected no product validation",
  })
})

test("requires both selected products for a cross-product PR", () => {
  const cross = {
    ...base,
    momiSelected: "true",
    momiResult: "success",
    moxiSelected: "true",
    moxiResult: "success",
  }
  assert.equal(evaluateProductValidation(cross).ok, true)
  assert.deepEqual(
    evaluateProductValidation({ ...cross, moxiResult: "failure" }),
    { ok: false, message: "MoXi result is failure" },
  )
})

for (const result of ["cancelled", "skipped", "", undefined]) {
  test(`fails when a selected product result is ${result || "missing"}`, () => {
    assert.equal(
      evaluateProductValidation({
        ...base,
        momiSelected: "true",
        momiResult: result,
      }).ok,
      false,
    )
  })
}

test("fails when routing fails or does not report a valid selection", () => {
  assert.equal(
    evaluateProductValidation({ ...base, routingResult: "failure" }).ok,
    false,
  )
  assert.equal(
    evaluateProductValidation({ ...base, momiSelected: "" }).ok,
    false,
  )
})
