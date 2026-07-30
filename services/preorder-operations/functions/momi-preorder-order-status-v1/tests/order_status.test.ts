import assert from "node:assert/strict";
import test from "node:test";

import { handleRequestWithReader } from "../src/handle_request_with_reader.ts";

const orderId = "30000000-0000-4000-8000-000000000003";

test("returns customer-safe durable status", async () => {
  let capturedAuthority = "";
  const response = await handleRequestWithReader(new Request(
    `https://example.test/?order_id=${orderId}`,
    { headers: { "x-momi-recovery-authority": "recovery-authority" } },
  ), (_id, authority) => {
    capturedAuthority = authority;
    return Promise.resolve({
      admitted: true,
      data: {
        order_id: orderId,
        order_version: 1,
        order_status: "awaiting_payment",
        payment_status: "not_started",
        allowed_actions: ["view_status"],
      },
    });
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(capturedAuthority, "recovery-authority");
  assert.equal(body.meta.contract_key, "momi.preorder.order_status.read.v1");
  assert.equal(body.data.order_status, "awaiting_payment");
  assert.doesNotMatch(JSON.stringify(body), /recovery-authority/);
});

test("makes invalid, unauthorized, limited, and failed reads indistinguishable safely", async () => {
  const invalid = await handleRequestWithReader(new Request(
    "https://example.test/?order_id=not-an-id",
  ), () => Promise.resolve({ admitted: true, data: null }));
  assert.equal(invalid.status, 400);
  const missing = await handleRequestWithReader(new Request(
    `https://example.test/?order_id=${orderId}`,
  ), () => Promise.resolve({ admitted: true, data: null }));
  assert.equal(missing.status, 404);
  const limited = await handleRequestWithReader(new Request(
    `https://example.test/?order_id=${orderId}`,
  ), () => Promise.resolve({ admitted: false, data: null }));
  assert.equal(limited.status, 429);
  const unavailable = await handleRequestWithReader(new Request(
    `https://example.test/?order_id=${orderId}`,
  ), () => Promise.reject(new Error("database detail")));
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(await unavailable.text(), /database detail/);
});
