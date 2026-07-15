import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("successful pagination exhausts a durable budget, not retry attempts", async () => {
  const jobs = await readFile(
    new URL(
      "../../../../../supabase/migrations/20260714174910_create_toast_acquisition_jobs.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const lifecycle = await readFile(
    new URL(
      "../../../../../supabase/migrations/20260714175719_create_toast_acquisition_work_functions.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const finalizer = await readFile(
    new URL("../src/finalize_page.ts", import.meta.url),
    "utf8",
  );

  assert.match(jobs, /page_count integer not null default 0/);
  assert.match(jobs, /page_budget integer not null default 1000/);
  assert.match(lifecycle, /and job\.page_count < job\.page_budget/);
  assert.match(lifecycle, /page_count = job\.page_count \+ 1/);
  assert.match(lifecycle, /job\.page_count \+ 1 >= job\.page_budget/);
  assert.match(lifecycle, /'budget_exhausted'/);
  assert.match(
    lifecycle,
    /last_error = case[\s\S]*toast_pagination_budget_exhausted/,
  );
  assert.match(lifecycle, /attempt_count = 0/);
  assert.doesNotMatch(lifecycle, /page_count = 0/);
  assert.match(finalizer, /disposition === "budget_exhausted"/);
  assert.match(
    finalizer,
    /"dead_letter",[\s\S]*"toast_pagination_budget_exhausted"/,
  );
});
