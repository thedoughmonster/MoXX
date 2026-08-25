import assert from "node:assert/strict";
import test from "node:test";

import { deriveResource } from "../src/derive_resource.ts";
import { makeFixture } from "./test_fixture.ts";

test("device metadata changes retain stable source identity", async () => {
  const { operation } = makeFixture();
  const deviceOperation = { ...operation, resource_type: "device" };
  const first = await deriveResource({
    serialNumber: "serial-123",
    PosDeviceInfo: { deviceId: "nested-456", model: "old" },
  }, deviceOperation);
  const changed = await deriveResource({
    serialNumber: "serial-123",
    PosDeviceInfo: { deviceId: "nested-789", model: "new" },
  }, deviceOperation);

  assert.equal(first.source_id, "serial-123");
  assert.equal(changed.source_id, first.source_id);
  assert.notEqual(changed.content_hash, first.content_hash);
});

test("device identity falls back to nested device ID before content hash", async () => {
  const { operation } = makeFixture();
  const deviceOperation = { ...operation, resource_type: "device" };
  const nested = await deriveResource({
    serialNumber: "",
    PosDeviceInfo: { deviceId: "nested-456", model: "KDS" },
  }, deviceOperation);
  const nestedChanged = await deriveResource({
    PosDeviceInfo: { deviceId: "nested-456", model: "terminal" },
  }, deviceOperation);
  const anonymous = await deriveResource({ model: "unknown" }, deviceOperation);

  assert.equal(nested.source_id, "nested-456");
  assert.equal(nestedChanged.source_id, nested.source_id);
  assert.notEqual(nestedChanged.content_hash, nested.content_hash);
  assert.equal(anonymous.source_id, anonymous.content_hash);
});
