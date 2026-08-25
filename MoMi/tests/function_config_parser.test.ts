import assert from "node:assert/strict"
import test from "node:test"

import { parseFunctionVerifyJwt } from
  "../scripts/deploy/parse_function_verify_jwt.ts"

test("discovers a function section with the Supabase JWT default", () => {
  assert.deepEqual(
    [...parseFunctionVerifyJwt("[functions.fixture-v1]\n")],
    [["fixture-v1", true]],
  )
})

test("rejects duplicate function sections", () => {
  assert.throws(
    () => parseFunctionVerifyJwt(
      "[functions.fixture-v1]\n[functions.fixture-v1]\n",
    ),
    /duplicate function section/,
  )
})

test("rejects unsupported function section syntax", () => {
  assert.throws(
    () => parseFunctionVerifyJwt("[functions.\"fixture-v1\"]\n"),
    /unsupported function section/,
  )
  assert.throws(
    () => parseFunctionVerifyJwt("[\"functions\".\"fixture-v1\"]\n"),
    /unsupported function section/,
  )
})

test("rejects dotted and inline function declarations", () => {
  for (const source of [
    "functions.orphan-v1.verify_jwt = false\n",
    "functions.\"orphan-v1\".verify_jwt = false\n",
    "functions = { orphan-v1 = { verify_jwt = false } }\n",
  ]) {
    assert.throws(
      () => parseFunctionVerifyJwt(source),
      /unsupported function declaration/,
    )
  }
})

test("rejects Unicode-escaped function and JWT keys", () => {
  for (const source of [
    "[\"\\u0066unctions\".orphan-v1]\nverify_jwt = false\n",
    "[ \"\\u0066unctions\" . orphan-v1 ]\nverify_jwt = false\n",
    "\"\\u0066unctions\".orphan-v1.verify_jwt = false\n",
    "\"\\u0066unctions\" = { orphan-v1 = { verify_jwt = false } }\n",
    "[functions.fixture-v1]\n\"\\u0076erify_jwt\" = false\n",
  ]) {
    assert.throws(
      () => parseFunctionVerifyJwt(source),
      /unsupported escaped TOML key/,
    )
  }
})

test("rejects duplicate or invalid verify_jwt settings", () => {
  assert.throws(
    () => parseFunctionVerifyJwt(
      "[functions.fixture-v1]\nverify_jwt = false\nverify_jwt = true\n",
    ),
    /duplicate verify_jwt/,
  )
  assert.throws(
    () => parseFunctionVerifyJwt(
      "[functions.fixture-v1]\nverify_jwt = maybe\n",
    ),
    /invalid verify_jwt/,
  )
  assert.throws(
    () => parseFunctionVerifyJwt(
      "[functions.fixture-v1]\n\"verify_jwt\" = false\n",
    ),
    /invalid verify_jwt/,
  )
})
