import assert from "node:assert/strict";
import test from "node:test";

import { buildRegisteredRequest } from "../src/build_request.ts";
import { fetchSourcePage } from "../src/fetch_source_page.ts";
import { parseAcquisitionInput } from "../src/parse_request.ts";
import { selectSafeHeaders } from "../src/select_safe_headers.ts";
import { makeFixture } from "./test_fixture.ts";

const token = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

test("accepts only job_id and capability_token from the caller", () => {
  assert.deepEqual(
    parseAcquisitionInput({ job_id: 42, capability_token: token }),
    {
      job_id: "42",
      capability_token: token,
    },
  );
  for (
    const extra of [
      { url: "https://evil.example" },
      { method: "DELETE" },
      { parameters: { page: 99 } },
    ]
  ) {
    assert.equal(
      parseAcquisitionInput({ job_id: 42, capability_token: token, ...extra }),
      null,
    );
  }
});

test("rejects unregistered parameters and non-GET operations", () => {
  const { job, operation } = makeFixture();
  assert.throws(() =>
    buildRegisteredRequest({
      ...job,
      parameters: { url: "https://evil.example", method: "POST" },
    }, operation), /unregistered/);
  assert.throws(() =>
    buildRegisteredRequest(job, {
      ...operation,
      http_method: "POST",
    }), /not GET/);
  const request = buildRegisteredRequest(job, operation);
  assert.equal(new URL(request.url).origin, "https://toast.example");
  assert.match(request.url, /\/orders\/v2\/ordersBulk\?/);
});

test("archives only allowlisted non-secret headers", () => {
  const headers = new Headers({
    Authorization: "Bearer secret-token",
    Cookie: "session=secret",
    "X-Api-Key": "secret-key",
    Link: '<https://toast.example/items?page=2>; rel="next"',
    "Toast-Next-Page-Token": "cursor-2",
    "X-Request-Id": "request-1",
  });
  const safe = selectSafeHeaders(headers);
  assert.equal(safe.authorization, undefined);
  assert.equal(safe.cookie, undefined);
  assert.equal(safe["x-api-key"], undefined);
  assert.equal(safe["toast-next-page-token"], "cursor-2");
  assert.equal(safe["x-request-id"], "request-1");
  assert.doesNotMatch(JSON.stringify(safe), /secret/);
});

test("source transport uses the registered GET without following redirects", async () => {
  const { job, operation } = makeFixture();
  const request = buildRegisteredRequest(job, operation);
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return Promise.resolve(Response.json([]));
  };
  await fetchSourcePage(request, 5000, "Bearer", "access-token", fetchImpl);
  assert.equal(capturedUrl, request.url);
  assert.equal(capturedInit?.method, "GET");
  assert.equal(capturedInit?.redirect, "error");
  assert.equal(
    new Headers(capturedInit?.headers).get("authorization"),
    "Bearer access-token",
  );
});
