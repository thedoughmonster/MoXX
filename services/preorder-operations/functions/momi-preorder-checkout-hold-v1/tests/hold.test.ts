import assert from "node:assert/strict";
import test from "node:test";

import { handleRequestWithExecutor } from "../src/handle_request_with_executor.ts";
import { parseRequest } from "../src/parse_request.ts";

const request = {
  command_id: "10000000-0000-4000-8000-000000000001",
  action: "create" as const,
  quote_id: "20000000-0000-4000-8000-000000000002",
  expected_quote_version: 1,
};

test("parses only bounded hold commands", () => {
  assert.deepEqual(parseRequest(request), request);
  assert.equal(parseRequest({ ...request, extra: true }), null);
  assert.equal(parseRequest({ ...request, hold_id: request.quote_id }), null);
  assert.equal(parseRequest({ ...request, action: "release" }), null);
});

test("returns the versioned hold envelope without exposing authority", async () => {
  let capturedAuthority = "";
  const response = await handleRequestWithExecutor(new Request(
    "https://example.test/",
    {
      method: "POST",
      headers: { "x-momi-checkout-authority": "checkout-authority" },
      body: JSON.stringify(request),
    },
  ), (_input, authority) => {
    capturedAuthority = authority;
    return Promise.resolve({
      admitted: true,
      result: {
        outcome: "accepted",
        hold_id: "30000000-0000-4000-8000-000000000003",
        hold_version: 1,
        hold_status: "active",
        expires_at: "2026-08-01T10:00:00Z",
      },
    });
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(capturedAuthority, "checkout-authority");
  assert.equal(body.meta.contract_key, "momi.preorder.checkout_hold.manage.v1");
  assert.equal(body.hold_status, "active");
  assert.doesNotMatch(JSON.stringify(body), /checkout-authority/);
});

test("fails safely for conflicts, limits, and unavailable storage", async () => {
  const conflict = await handleRequestWithExecutor(new Request(
    "https://example.test/",
    { method: "POST", body: JSON.stringify(request) },
  ), () => Promise.resolve({
    admitted: true,
    result: {
      outcome: "conflict",
      error: {
        code: "capacity_unavailable",
        message: "That pickup window is full.",
        retryable: true,
        next_action: "choose_another_window",
      },
    },
  }));
  assert.equal(conflict.status, 409);
  const limited = await handleRequestWithExecutor(new Request(
    "https://example.test/",
    { method: "POST", body: JSON.stringify(request) },
  ), () => Promise.resolve({ admitted: false, result: null }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
  const unavailable = await handleRequestWithExecutor(new Request(
    "https://example.test/",
    { method: "POST", body: JSON.stringify(request) },
  ), () => Promise.reject(new Error("private failure")));
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(await unavailable.text(), /private failure/);
});
