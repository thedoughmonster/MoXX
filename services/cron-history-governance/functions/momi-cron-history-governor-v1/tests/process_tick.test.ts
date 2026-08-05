import assert from "node:assert/strict";
import test from "node:test";

import { processTick } from "../src/process_tick.ts";
import type {
  GovernorDependencies,
  ProviderMetricSample,
  TickInput,
} from "../src/types.ts";

const input: TickInput = {
  tick_id: "11111111-1111-4111-8111-111111111111",
  capability_token: "22222222-2222-4222-8222-222222222222",
};
const sample: ProviderMetricSample = {
  sourceObservedAt: "2026-08-05T00:00:00.000Z",
  cpuTotalSeconds: 100,
  cpuIdleSeconds: 80,
  ramPct: 40,
  swapUsedBytes: 0,
  ioBusySeconds: 10,
  allocatedDiskPct: 50,
  providerConnections: 6,
  providerWarning: false,
  sourceComplete: true,
};

test("returns an existing receipt without scraping on replay", async () => {
  let collected = false;
  const dependencies: GovernorDependencies = {
    claim: () => Promise.resolve({ tick_status: "completed", phase: "drain" }),
    collect: () => {
      collected = true;
      return Promise.resolve(sample);
    },
    record: () => Promise.resolve(null),
    readReceipt: () =>
      Promise.resolve({
        ok: true,
        function_key: "momi.cron_history.governor.v1",
        tick_id: input.tick_id,
        disposition: "completed",
      }),
  };
  const result = await processTick(input, dependencies);
  assert.equal(result.status, 200);
  assert.equal(collected, false);
});

test("reconciles an unknown record response with one exact readback", async () => {
  let readbacks = 0;
  const dependencies: GovernorDependencies = {
    claim: () => Promise.resolve({ tick_status: "claimed", phase: "canary" }),
    collect: () => Promise.resolve(sample),
    record: () => Promise.reject(new Error("connection_lost")),
    readReceipt: () => {
      readbacks += 1;
      return Promise.resolve({
        ok: true,
        function_key: "momi.cron_history.governor.v1",
        tick_id: input.tick_id,
        disposition: "completed",
      });
    },
  };
  const result = await processTick(input, dependencies);
  assert.equal(result.status, 200);
  assert.equal(readbacks, 1);
});

test("reports unknown commit after one failed exact readback", async () => {
  let readbacks = 0;
  const dependencies: GovernorDependencies = {
    claim: () => Promise.resolve({ tick_status: "claimed", phase: "drain" }),
    collect: () => Promise.resolve(sample),
    record: () => Promise.reject(new Error("connection_lost")),
    readReceipt: () => {
      readbacks += 1;
      return Promise.resolve(null);
    },
  };
  const result = await processTick(input, dependencies);
  assert.equal(result.status, 503);
  assert.equal(result.body.disposition, "unknown_commit");
  assert.equal(readbacks, 1);
});
