import assert from "node:assert/strict"
import test from "node:test"

import { validateJson } from "../scripts/architecture/validate_json.ts"

test("validates separately loaded copies of the same schema id", () => {
  const schema = {
    $id: "https://momi.local/schemas/repeated-test.schema.json",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {
      value: { type: "string" },
    },
    required: ["value"],
    additionalProperties: false,
  }

  assert.doesNotThrow(() => validateJson(
    structuredClone(schema),
    { value: "first" },
    "first",
  ))
  assert.doesNotThrow(() => validateJson(
    structuredClone(schema),
    { value: "second" },
    "second",
  ))
})
