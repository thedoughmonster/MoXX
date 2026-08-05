import assert from "node:assert/strict";
import test from "node:test";

import { reduceMetrics } from "../src/reduce_metrics.ts";

const fixture = [
  'node_cpu_seconds_total{cpu="0",mode="idle"} 80',
  'node_cpu_seconds_total{cpu="0",mode="user"} 20',
  "node_memory_MemTotal_bytes 1000",
  "node_memory_MemAvailable_bytes 400",
  "node_memory_SwapTotal_bytes 100",
  "node_memory_SwapFree_bytes 100",
  'node_disk_io_time_seconds_total{device="nvme0n1"} 12',
  'node_filesystem_size_bytes{device="/dev/nvme0n1",mountpoint="/"} 1000',
  'node_filesystem_avail_bytes{device="/dev/nvme0n1",mountpoint="/"} 300',
  'pg_stat_database_numbackends{datname="postgres"} 6',
  "supabase_provider_pressure 0",
].join("\n");

test("reduces only allowlisted metrics into a complete sanitized sample", () => {
  const sample = reduceMetrics(
    fixture,
    "2026-08-05T00:00:00.000Z",
    ["supabase_provider_pressure"],
  );
  assert.equal(sample.sourceComplete, true);
  assert.equal(sample.cpuTotalSeconds, 100);
  assert.equal(sample.cpuIdleSeconds, 80);
  assert.equal(sample.ramPct, 60);
  assert.equal(sample.swapUsedBytes, 0);
  assert.equal(sample.ioBusySeconds, 12);
  assert.equal(sample.allocatedDiskPct, 70);
  assert.equal(sample.providerConnections, 6);
  assert.equal(sample.providerWarning, false);
  assert.doesNotMatch(JSON.stringify(sample), /node_|pg_stat|fixture/u);
});

test("fails closed when the configured provider warning metric is absent", () => {
  const sample = reduceMetrics(
    fixture,
    "2026-08-05T00:00:00.000Z",
    ["different_pressure_metric"],
  );
  assert.equal(sample.sourceComplete, false);
  assert.equal(sample.providerWarning, null);
});
