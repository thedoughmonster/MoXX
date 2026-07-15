import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = (name: string) =>
  readFile(
    new URL(
      `../../../../../supabase/migrations/${name}`,
      import.meta.url,
    ),
    "utf8",
  );

test("raw archive rejects authorization headers case-insensitively", async () => {
  const source = await migration(
    "20260714174934_create_toast_acquisition_archive.sql",
  );
  assert.match(source, /jsonb_object_keys\(p_headers\)/);
  assert.match(source, /lower\(header\.name\).*lower\(p_header\)/s);
  assert.match(source, /not toast_raw\.has_header\(request_headers/);
});

test("acquisition wakeup reclaims expired leases and caps attempts", async () => {
  const source = await migration(
    "20260714182310_create_toast_acquisition_trigger_adapter.sql",
  );
  assert.match(source, /status = 'running' and lease_expires_at <= now\(\)/);
  assert.match(source, /attempt_count >= 12 then 'dead_letter'/);
  assert.match(source, /lease_expires_at = null/);
});
