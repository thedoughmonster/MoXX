import assert from "node:assert/strict"
import test from "node:test"

import { deriveResource } from "../services/toast-data-acquisition/functions/toast-data-acquisition-v1/src/derive_resource.ts"
import { extractResponseResources } from "../services/toast-data-acquisition/functions/toast-data-acquisition-v1/src/extract_resources.ts"
import type { RegisteredOperation } from "../services/toast-data-acquisition/functions/toast-data-acquisition-v1/src/registry_types.ts"

test("preserves group GUID objects separately from restaurant detail", async () => {
  const guid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  const groupOperation = {
    response_kind: "collection",
  } as RegisteredOperation
  const detailOperation = {
    response_kind: "document",
  } as RegisteredOperation

  const groupPayload = extractResponseResources(
    [{ guid }], groupOperation, 200,
  )[0]!
  const groupRecord = await deriveResource(groupPayload, groupOperation)
  assert.deepEqual(groupPayload, { guid })
  assert.equal(groupRecord.source_id, guid)

  const detail = {
    guid,
    general: { firstBusinessDate: "20200102" },
  }
  const detailPayload = extractResponseResources(
    detail, detailOperation, 200,
  )[0]!
  const detailRecord = await deriveResource(detailPayload, detailOperation)
  assert.deepEqual(detailPayload, detail)
  assert.deepEqual(detailRecord.payload, detail)
  assert.equal(Object.hasOwn(detailRecord.payload, "value"), false)
})
