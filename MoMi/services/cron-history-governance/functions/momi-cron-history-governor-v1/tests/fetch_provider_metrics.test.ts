import assert from "node:assert/strict";
import test from "node:test";
import { fetchMetrics } from "../src/fetch-provider-metrics.ts";
import {
  syntheticDeployment, syntheticMetricsEnvironment, syntheticRefs, syntheticSecret,
  withMetricsRuntime,
} from "./metrics_runtime_fixture.ts";

test("fetches only the bound metrics endpoint with Basic service_role, no redirects, and a two-second limit", async (t) => {
  const signal = new AbortController().signal;
  const timeout = t.mock.method(AbortSignal, "timeout", () => signal);
  const request = t.mock.method(globalThis, "fetch", (_input, _init) =>
    Promise.resolve(new Response("metric 1", { headers: { date: "Thu, 22 Oct 2026 16:00:00 GMT" } })));
  for (const ref of syntheticRefs) {
    await withMetricsRuntime({
      ...syntheticMetricsEnvironment,
      SUPABASE_URL: `https://${ref}.supabase.co`,
      DENO_DEPLOYMENT_ID: `${ref}_${syntheticDeployment}`,
    }, async () => {
      assert.deepEqual(await fetchMetrics(), { text: "metric 1", observedAt: "2026-10-22T16:00:00.000Z" });
      const [url, options] = request.mock.calls.at(-1)!.arguments;
      assert.equal(String(url), `https://${ref}.supabase.co/customer/v1/privileged/metrics`);
      assert.equal(options?.redirect, "error");
      assert.equal(options?.signal, signal);
      assert.deepEqual(timeout.mock.calls.at(-1)!.arguments, [2000]);
      const headers = new Headers(options?.headers);
      assert.equal(headers.get("accept"), "text/plain");
      assert.equal(headers.get("authorization"), `Basic ${btoa(`service_role:${syntheticSecret}`)}`);
    });
  }
  assert.equal(request.mock.callCount(), 2);
});

test("invalid runtime configuration fails generically before any HTTP request", async (t) => {
  const request = t.mock.method(globalThis, "fetch", () => Promise.reject(new Error("must not fetch")));
  for (const overrides of [
    { SUPABASE_SECRET_KEYS: undefined }, { SUPABASE_SECRET_KEYS: `{${syntheticSecret}` },
    { SUPABASE_SECRET_KEYS: JSON.stringify({ other: syntheticSecret }) },
    { SUPABASE_URL: "https://other-project.supabase.co" }, { DENO_DEPLOYMENT_ID: undefined },
    { DENO_DEPLOYMENT_ID: `${syntheticRefs[1]}_${syntheticDeployment}` },
  ]) {
    await withMetricsRuntime({ ...syntheticMetricsEnvironment, ...overrides }, async () => {
      await assert.rejects(fetchMetrics, { message: "metrics_configuration_missing" });
    });
  }
  assert.equal(request.mock.callCount(), 0);
});

test("request exceptions including refused redirects never expose credentials or provider detail", async (t) => {
  const request = t.mock.method(globalThis, "fetch", (_url, options) => {
    assert.equal(options?.redirect, "error");
    return Promise.reject(new TypeError(`redirect refused; Authorization: ${syntheticSecret}`));
  });
  await withMetricsRuntime(syntheticMetricsEnvironment, async () => {
    await assert.rejects(fetchMetrics, { message: "metrics_request_failed" });
  });
  assert.equal(request.mock.callCount(), 1);
});

test("body-read exceptions expose only the generic response failure", async (t) => {
  const response = new Response(null);
  t.mock.method(response, "text", () => Promise.reject(new Error(`stream failed: ${syntheticSecret}`)));
  t.mock.method(globalThis, "fetch", () => Promise.resolve(response));
  await withMetricsRuntime(syntheticMetricsEnvironment, async () => {
    await assert.rejects(fetchMetrics, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "metrics_response_failed");
      assert.equal(error.cause, undefined);
      assert.doesNotMatch(String(error), /sb_secret_|synthetic_test_key/u);
      return true;
    });
  });
});

test("keeps provider error bodies and redirects out of returned failures", async (t) => {
  for (const status of [302, 401, 503]) {
    t.mock.method(globalThis, "fetch", () => Promise.resolve(new Response(syntheticSecret, {
      status, headers: { location: "https://example.test/collect" },
    })));
    await withMetricsRuntime(syntheticMetricsEnvironment, async () => {
      await assert.rejects(fetchMetrics, { message: `metrics_http_${status}` });
    });
    t.mock.restoreAll();
  }
});

test("retains both declared and actual two-megabyte response guards", async (t) => {
  for (const response of [
    new Response("not read", { headers: { "content-length": "2000001" } }),
    new Response("x".repeat(2_000_001)),
  ]) {
    t.mock.method(globalThis, "fetch", () => Promise.resolve(response));
    await withMetricsRuntime(syntheticMetricsEnvironment, async () => {
      await assert.rejects(fetchMetrics, { message: "metrics_too_large" });
    });
    t.mock.restoreAll();
  }
});
