import assert from "node:assert/strict";
import test from "node:test";

import { handleRequestWithCreator } from "../src/handle_request_with_creator.ts";
import { parseRequest } from "../src/parse_request.ts";
import { fixture } from "./fixture.ts";

test("parses only the frozen quote command", () => {
  assert.deepEqual(parseRequest(fixture.request), fixture.request);
  assert.equal(parseRequest({ ...fixture.request, extra: true }), null);
  assert.equal(
    parseRequest({
      ...fixture.request,
      avoided_allergens: ["unknown"],
    }),
    null,
  );
  assert.equal(
    parseRequest({
      ...fixture.request,
      lines: [{ ...(fixture.request.lines as object[])[0], quantity: 101 }],
    }),
    null,
  );
});

test("returns an accepted authoritative quote envelope", async () => {
  const response = await handleRequestWithCreator(
    new Request(
      "https://example.test/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fixture.request),
      },
    ),
    () => Promise.resolve({ admitted: true, result: fixture.response }),
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.meta.contract_key, "momi.preorder.quote.create.v1");
  assert.deepEqual(body.quote, fixture.response.quote);
});

test("supports preflight and rejects unsupported methods", async () => {
  const preflight = await handleRequestWithCreator(
    new Request(
      "https://example.test/",
      { method: "OPTIONS" },
    ),
    () => Promise.resolve({ admitted: false, result: null }),
  );
  assert.equal(preflight.status, 204);
  const rejected = await handleRequestWithCreator(
    new Request(
      "https://example.test/",
      { method: "GET" },
    ),
    () => Promise.resolve({ admitted: false, result: null }),
  );
  assert.equal(rejected.status, 405);
});
