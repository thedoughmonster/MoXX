import assert from "node:assert/strict";
import test from "node:test";

import { executeAuthenticatedFetch } from "../src/execute_authenticated_fetch.ts";
import { getToastToken } from "../src/get_toast_token.ts";
import { invalidateToastToken } from "../src/invalidate_toast_token.ts";
import type { TokenConfig } from "../src/runtime_types.ts";

const config: TokenConfig = {
  api_base_url: "https://toast.example",
  client_id: "client-id",
  client_secret: "client-secret",
  user_access_type: "TOAST_MACHINE_CLIENT",
  request_timeout_ms: 5000,
};

test("does not reuse a token inside the expiry safety window", async () => {
  invalidateToastToken();
  let calls = 0;
  const fetchImpl: typeof fetch = () => {
    calls += 1;
    return Promise.resolve(Response.json({
      token: {
        tokenType: "Bearer",
        accessToken: `token-${calls}`,
        expiresIn: 30,
      },
    }));
  };
  const first = await getToastToken(config, fetchImpl);
  const second = await getToastToken(config, fetchImpl);
  assert.equal(first.ok && first.access_token, "token-1");
  assert.equal(second.ok && second.access_token, "token-2");
  assert.equal(calls, 2);
});

test("archives a 401 attempt then retries once with a fresh token", async () => {
  let tokenCalls = 0;
  let sourceAttempts = 0;
  let invalidations = 0;
  const usedTokens: string[] = [];
  const result = await executeAuthenticatedFetch(config, {
    get_token: () => {
      tokenCalls += 1;
      return Promise.resolve({
        ok: true as const,
        token_type: "Bearer",
        access_token: `token-${tokenCalls}`,
      });
    },
    invalidate_token: () => {
      invalidations += 1;
    },
    perform: (_type, accessToken) => {
      sourceAttempts += 1;
      usedTokens.push(accessToken);
      return Promise.resolve({
        kind: "response" as const,
        page: {
          attempt_id: `attempt-${sourceAttempts}`,
          status: sourceAttempts === 1 ? 401 : 200,
          raw_body: "[]",
          parsed_body: { has_json: true, json: [] },
          response_headers: {},
          retrieved_at: "2026-07-14T12:00:00.000Z",
        },
      });
    },
  });
  assert.equal(result.kind, "response");
  assert.equal(result.kind === "response" && result.page.status, 200);
  assert.deepEqual(usedTokens, ["token-1", "token-2"]);
  assert.equal(sourceAttempts, 2);
  assert.equal(invalidations, 1);
});
