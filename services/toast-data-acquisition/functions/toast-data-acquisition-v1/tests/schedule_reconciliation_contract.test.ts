import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("current-only schedules remain due until a durable job is inserted", async () => {
  const source = await readFile(
    new URL(
      "../../../../../supabase/migrations/" +
        "20260714175723_schedule_warehouse_backbone_reconciliation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const captureCheck = source.indexOf(
    "capture_window_is_open(due.window_key, now())",
  );
  const inserted = source.indexOf("inserted := true");
  const advanceGuard = source.indexOf(
    "if inserted or due.window_lookback_seconds is not null then",
  );
  const advance = source.indexOf(
    "update toast_acquisition.schedules",
    advanceGuard,
  );
  assert.ok(captureCheck >= 0 && inserted > captureCheck);
  assert.ok(advanceGuard > inserted && advance > advanceGuard);
  assert.match(
    source,
    /inserted := false;[\s\S]*on conflict \(idempotency_key\) do nothing/,
  );
});
