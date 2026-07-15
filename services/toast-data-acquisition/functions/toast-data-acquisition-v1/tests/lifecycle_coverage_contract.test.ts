import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildRegisteredRequest } from "../src/build_request.ts";
import { resolveTokenConflictRestart } from
  "../src/resolve_token_conflict_restart.ts";
import { makeFixture } from "./test_fixture.ts";

const migration = (name: string) => readFile(new URL(
  `../../../../../supabase/migrations/${name}`, import.meta.url), "utf8");

test("successful pages reset the failure streak without losing crash counting", async () => {
  const lifecycle = await migration(
    "20260714175719_create_toast_acquisition_work_functions.sql",
  );
  const wakeup = await migration(
    "20260714182310_create_toast_acquisition_trigger_adapter.sql",
  );
  assert.match(lifecycle,
    /set status = 'running', attempt_count = attempt_count \+ 1/);
  assert.match(lifecycle, /else 'pending' end,[\s\S]*attempt_count = 0/);
  assert.match(lifecycle, /set status = 'succeeded',[\s\S]*attempt_count = 0/);
  assert.match(wakeup, /status = 'running' and lease_expires_at <= now\(\)/);
  assert.match(wakeup, /attempt_count >= 12 then 'dead_letter'/);
});

test("only an archived stale token conflict restarts page one", () => {
  const { job, operation } = makeFixture();
  const cursorOperation = {
    ...operation,
    pagination_kind: "cursor" as const,
    page_size: null,
    requires_window: false,
    operation_parameters: [{
      parameter_key: "pageToken",
      parameter_location: "query" as const,
      data_type: "string" as const,
      required: false,
      validation_pattern: null,
    }],
  };
  const request = buildRegisteredRequest(
    {
      ...job,
      window_start: null,
      window_end: null,
      cursor: { pageToken: "old" },
    },
    cursorOperation,
  );
  assert.deepEqual(resolveTokenConflictRestart(cursorOperation, request, 409), {});
  assert.equal(resolveTokenConflictRestart(
    cursorOperation, { ...request, request_cursor: {} }, 409), null);
  assert.equal(resolveTokenConflictRestart(cursorOperation, request, 500), null);
  assert.equal(resolveTokenConflictRestart(operation, request, 409), null);
});

test("cursor restart rotates capability without resetting the failure streak", async () => {
  const source = await migration(
    "20260715055909_harden_toast_acquisition_lifecycle.sql",
  );
  const process = await readFile(
    new URL("../src/process_page.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /p_cursor \? 'pageToken'/);
  assert.match(source, /job\.cursor \? 'pageToken'/);
  assert.match(source, /capability_token = next_token/);
  assert.doesNotMatch(source, /attempt_count\s*=/);
  assert.match(process,
    /resolveTokenConflictRestart\([\s\S]*restartTokenCursorJob/);
});

test("coverage records current-only success and durable failure outcomes", async () => {
  const process = await readFile(
    new URL("../src/process_page.ts", import.meta.url),
    "utf8",
  );
  const success = await readFile(
    new URL("../src/record_coverage.ts", import.meta.url),
    "utf8",
  );
  const failure = await readFile(
    new URL("../src/record_failure_coverage.ts", import.meta.url),
    "utf8",
  );
  const recover = await readFile(
    new URL("../src/recover_job.ts", import.meta.url),
    "utf8",
  );
  const lifecycle = await migration(
    "20260715055909_harden_toast_acquisition_lifecycle.sql",
  );
  assert.match(process, /if \(!paginationContinues\)/);
  assert.doesNotMatch(process, /operation\.requires_window/);
  assert.match(success, /record_count = 0[\s\S]*then 'empty'/);
  assert.match(success, /http_status between 200 and 299 and error_code is null/);
  assert.match(failure, /then 'dead_letter'/);
  assert.match(failure, /then 'partial'[\s\S]*else 'gap'/);
  assert.match(lifecycle, /'accepted_gap', 'dead_letter'/);
  assert.ok(
    recover.indexOf("await recordFailureCoverage") >
      recover.indexOf("await failJob(job"),
  );
});
