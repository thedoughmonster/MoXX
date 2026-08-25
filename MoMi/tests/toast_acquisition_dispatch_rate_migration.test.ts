import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../supabase/migrations/", import.meta.url);
const migration = await readFile(
  new URL("20260715131907_accelerate_toast_acquisition_dispatch.sql", root),
  "utf8",
);
const lifecycle = await readFile(
  new URL("20260715132150_route_toast_pagination_through_dispatch.sql", root),
  "utf8",
);
const boundedHistory = await readFile(
  new URL("20260715152701_bound_toast_dispatch_history.sql", root),
  "utf8",
);
const increasedCapacity = await readFile(
  new URL("20260715165837_increase_toast_dispatch_capacity.sql", root),
  "utf8",
);

test("paces the central Toast dispatcher once per second", () => {
  assert.match(migration, /schedule := '1 second'/);
  assert.match(migration, /limit 1 for update of job skip locked/);
  assert.match(migration, /last_dispatched_at = now\(\)/);
  assert.match(migration, /interval '30 seconds'/);
});

test("keeps historical bulk orders five seconds apart", () => {
  assert.match(migration, /minimum_dispatch_spacing_seconds/);
  assert.match(migration, /minimum_dispatch_spacing_seconds = 5/);
  assert.match(migration, /operation_key = 'toast\.orders\.bulk\.v1'/);
  assert.match(migration, /dispatched\.last_dispatched_at > now\(\)/);
  assert.match(migration, /attempt\.started_at > now\(\)/);
});

test("routes new and continued work through the dispatcher", () => {
  assert.match(
    migration,
    /after update of capability_token[\s\S]*new\.status = 'retry_wait'/,
  );
  assert.match(migration, /drop trigger wake_acquisition_worker/);
  assert.match(lifecycle, /continue_job[\s\S]*last_dispatched_at = null/);
  assert.match(
    lifecycle,
    /restart_token_cursor_job[\s\S]*last_dispatched_at = null/,
  );
});

test("bounds dispatcher history without weakening operation spacing", () => {
  assert.match(boundedHistory, /^-- service-owner: toast-data-acquisition/);
  assert.match(
    boundedHistory,
    /dispatched\.last_dispatched_at > now\(\) - interval '60 seconds'/,
  );
  assert.match(
    boundedHistory,
    /attempt\.started_at > now\(\) - interval '60 seconds'/,
  );
  assert.match(boundedHistory, /secs => operation\.minimum_dispatch_spacing_seconds/g);
  assert.match(boundedHistory, /acquisition_jobs_recent_dispatch_idx/);
  assert.match(boundedHistory, /api_attempts_recent_started_idx/);
  assert.match(boundedHistory, /schedule := '1 second'/);
  assert.match(boundedHistory, /dispatch_command is null/);
  assert.match(boundedHistory, /Dispatch history bounds are invalid/);
});

test("doubles capacity without weakening operation fairness", () => {
  assert.match(increasedCapacity, /^-- service-owner: toast-data-acquisition/);
  assert.match(increasedCapacity, /maximum_dispatches_per_tick/);
  assert.match(increasedCapacity, /toast\.payments\.get\.v1/);
  assert.match(increasedCapacity,
    /partition by job\.operation_key, job\.restaurant_guid/);
  assert.match(increasedCapacity,
    /order by eligible\.operation_dispatch_rank, eligible\.priority/);
  assert.match(increasedCapacity, /limit 2 for update of job skip locked/);
  assert.match(increasedCapacity,
    /toast\.orders\.bulk\.v1'[\s\S]*is distinct from 5/);
});
