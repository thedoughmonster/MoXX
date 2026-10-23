import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest } from "../src/handle_request.ts";
import { isConfigured } from "../src/is_configured.ts";
import {
  syntheticMetricsEnvironment, syntheticSecret, withMetricsRuntime,
} from "./metrics_runtime_fixture.ts";

test("exposes a side-effect-free deployment liveness probe", async () => {
  const probe = await handleRequest(
    new Request("https://example.test/governor", { method: "OPTIONS" }),
  );
  assert.equal(probe.status, 204);
  assert.equal(probe.headers.get("allow"), "GET, POST, OPTIONS");
});

test("GET reports only configuration health without fetching or exposing runtime credentials", async (t) => {
  const request = t.mock.method(globalThis, "fetch", () => Promise.reject(new Error("must not fetch")));
  for (const [overrides, configured] of [
    [{ SUPABASE_DB_URL: "postgres://synthetic-db.invalid/test" }, true],
    [{ SUPABASE_DB_URL: undefined }, false],
    [{ SUPABASE_DB_URL: "synthetic-db", SUPABASE_SECRET_KEYS: "{}" }, false],
    [{ SUPABASE_DB_URL: "synthetic-db", DENO_DEPLOYMENT_ID: undefined }, false],
    [{ SUPABASE_DB_URL: "synthetic-db", SUPABASE_SECRET_KEYS: undefined,
      MOMI_CRON_HISTORY_METRICS_SECRET_KEY: syntheticSecret }, false],
  ] as const) {
    await withMetricsRuntime({ ...syntheticMetricsEnvironment, ...overrides }, async () => {
      assert.equal(isConfigured(), configured);
      const response = await handleRequest(new Request("https://example.test/governor"));
      assert.equal(response.status, configured ? 200 : 503);
      const body = await response.json();
      assert.equal(body.ok, configured);
      assert.equal(body.disposition, configured ? "configured" : "not_configured");
      assert.equal(body.receipt, null);
      assert.doesNotMatch(JSON.stringify(body), /sb_secret_|synthetic-db|SUPABASE_|DENO_/u);
    });
  }
  assert.equal(request.mock.callCount(), 0);
});
