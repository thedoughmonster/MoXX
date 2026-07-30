import assert from "node:assert/strict";
import test from "node:test";

import { handleRequestWithExecutor } from "../src/handle_request_with_executor.ts";
import { parseRequest } from "../src/parse_request.ts";

const request = {
  command_id: "10000000-0000-4000-8000-000000000001",
  quote_id: "20000000-0000-4000-8000-000000000002",
  expected_quote_version: 1,
  contact: { name: "Test Customer", email: "customer@example.test" },
};

test("parses minimum contact and rejects unowned fields", () => {
  assert.deepEqual(parseRequest(request), request);
  assert.equal(parseRequest({ ...request, notes: "private" }), null);
  assert.equal(parseRequest({ ...request, contact: { name: "Test" } }), null);
  assert.equal(parseRequest({
    ...request,
    contact: { ...request.contact, payment_token: "never" },
  }), null);
});

test("returns one durable unpaid intent and recovery authority", async () => {
  const response = await handleRequestWithExecutor(new Request(
    "https://example.test/",
    {
      method: "POST",
      headers: { "x-momi-checkout-authority": "checkout-authority" },
      body: JSON.stringify(request),
    },
  ), () => Promise.resolve({
    admitted: true,
    result: {
      outcome: "accepted",
      order_id: "30000000-0000-4000-8000-000000000003",
      order_version: 1,
      order_status: "awaiting_payment",
      amount_due: { currency: "USD", amount_minor: 1200 },
      recovery_authority: "recovery-authority",
    },
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.meta.contract_key, "momi.preorder.order_intent.create.v1");
  assert.equal(body.order_status, "awaiting_payment");
  assert.equal(body.recovery_authority, "recovery-authority");
  assert.doesNotMatch(JSON.stringify(body), /Test Customer|customer@example/);
});

test("maps duplicate conflicts and rate limits without private detail", async () => {
  const conflict = await handleRequestWithExecutor(new Request(
    "https://example.test/",
    { method: "POST", body: JSON.stringify(request) },
  ), () => Promise.resolve({
    admitted: true,
    result: {
      outcome: "conflict",
      error: {
        code: "stale_version",
        message: "This quote already created an order.",
        retryable: false,
        next_action: "refresh",
      },
    },
  }));
  assert.equal(conflict.status, 409);
  const limited = await handleRequestWithExecutor(new Request(
    "https://example.test/",
    { method: "POST", body: JSON.stringify(request) },
  ), () => Promise.resolve({ admitted: false, result: null }));
  assert.equal(limited.status, 429);
  assert.doesNotMatch(await limited.text(), /Test Customer|customer@example/);
});
