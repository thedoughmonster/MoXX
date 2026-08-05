import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest } from "../src/handle_request.ts";

const configurationKeys = [
  "SUPABASE_DB_URL",
  "SUPABASE_URL",
  "MOMI_CRON_HISTORY_METRICS_SECRET_KEY",
  "MOMI_CRON_HISTORY_PROVIDER_WARNING_METRICS",
];

test("separates deployment liveness from configured readiness", async () => {
  const previous = new Map(
    configurationKeys.map((key) => [key, Deno.env.get(key)]),
  );
  try {
    for (const key of configurationKeys) Deno.env.delete(key);

    const probe = await handleRequest(
      new Request("https://example.test/governor", { method: "OPTIONS" }),
    );
    assert.equal(probe.status, 204);
    assert.equal(probe.headers.get("allow"), "GET, POST, OPTIONS");

    const readiness = await handleRequest(
      new Request("https://example.test/governor"),
    );
    assert.equal(readiness.status, 503);
    assert.deepEqual(await readiness.json(), {
      ok: false,
      function_key: "momi.cron_history.governor.v1",
      tick_id: "00000000-0000-4000-8000-000000000000",
      disposition: "not_configured",
      phase: null,
      receipt: null,
    });
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
});
