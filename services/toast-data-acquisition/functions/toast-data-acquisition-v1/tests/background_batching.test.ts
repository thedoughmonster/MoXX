import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import { canContinueBatch } from "../src/can_continue_batch.ts";

const migrationsUrl = new URL(
  "../../../../../supabase/migrations/",
  import.meta.url,
);

async function migrationEnding(suffix: string): Promise<string> {
  const files = await readdir(migrationsUrl);
  const name = files.find((candidate) => candidate.endsWith(suffix));
  assert.ok(name, `Missing migration ending ${suffix}`);
  return readFile(new URL(name, migrationsUrl), "utf8");
}

test("background handoff stops with shutdown margin remaining", () => {
  assert.equal(canContinueBatch(400_000, 369_999), true);
  assert.equal(canContinueBatch(400_000, 370_000), false);
  assert.equal(canContinueBatch(400_000, 400_001), false);
});

test("payment detail batching is configured and atomically handed off", async () => {
  const source = await migrationEnding(
    "_configure_toast_acquisition_background_batches.sql",
  );
  assert.match(source, /worker_batch_enabled boolean not null default false/);
  assert.match(source, /worker_max_runtime_seconds integer/);
  assert.match(source, /worker_max_jobs integer/);
  assert.match(source, /maximum_active_workers integer/);
  assert.match(
    source,
    /set worker_batch_enabled = true[\s\S]*operation_key = 'toast\.payments\.get\.v1'/,
  );
  assert.match(source, /worker_max_runtime_seconds = 350/);
  assert.match(source, /worker_max_jobs = 250/);
  assert.match(source, /maximum_active_workers = 5/);
  assert.match(source, /complete_job_and_claim_next/);
  const completion = source.indexOf("status = 'succeeded'");
  const claim = source.indexOf("for update of candidate skip locked");
  assert.ok(completion >= 0 && claim > completion);
  assert.match(source, /attempt_count = candidate\.attempt_count \+ 1/);
  assert.match(source, /lease_expires_at = now\(\) \+ interval '120 seconds'/);
});

test("scheduler caps starts while background workers are active", async () => {
  const source = await migrationEnding(
    "_cap_toast_acquisition_background_workers.sql",
  );
  assert.match(source, /active_worker_count/);
  assert.match(source, /maximum_active_workers - active_worker_count/);
  assert.match(source, /limit 2 for update of job skip locked/);
  assert.match(source, /toast\.orders\.bulk\.v1'[\s\S]*is distinct from 5/);
});

test("internal handoff preserves the external dispatch timestamp", async () => {
  const source = await migrationEnding(
    "_preserve_toast_batch_worker_refill.sql",
  );
  assert.match(source, /create or replace function[\s\S]*claim_next/);
  assert.match(source, /status = 'running'/);
  assert.doesNotMatch(source, /last_dispatched_at\s*=/);
});

test("dispatcher paces only materialized ranked candidates", async () => {
  const source = await migrationEnding(
    "_optimize_toast_dispatch_candidate_ranking.sql",
  );
  assert.match(source, /ranked as materialized/);
  const ranked = source.indexOf("ranked.operation_dispatch_rank");
  const pacing = source.indexOf("from toast_raw.api_request_attempts", ranked);
  assert.ok(ranked >= 0 && pacing > ranked);
  assert.match(source, /maximum_active_workers = 4/);
  assert.match(source, /toast\.orders\.bulk\.v1'[\s\S]*is distinct from 5/);
});

test("HTTP returns after one job and continues through waitUntil", async () => {
  const handler = await readFile(
    new URL("../src/handle_request.ts", import.meta.url),
    "utf8",
  );
  const runner = await readFile(
    new URL("../src/run_background_batch.ts", import.meta.url),
    "utf8",
  );
  assert.match(handler, /EdgeRuntime\.waitUntil\(runBackgroundBatch/);
  assert.match(runner, /canContinueBatch\(deadline, Date\.now\(\)\)/);
  assert.match(runner, /processedJobs \+ 1 < continuation\.max_jobs/);
  assert.match(runner, /executeClaimedJob\(current, allowHandoff\)/);
  assert.doesNotMatch(runner, /Promise\.all/);
});
