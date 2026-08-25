import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("execution is release-gated, transactional, and read back", async () => {
  const releaseGate = await readFile(new URL(
    "./assert_released_dev.ts", import.meta.url,
  ), "utf8");
  const publisher = await readFile(new URL(
    "./publish_config.ts", import.meta.url,
  ), "utf8");
  const main = await readFile(new URL("./main.ts", import.meta.url), "utf8");
  assert.match(releaseGate, /receipt\.database !== "preview_apply_parity_complete"/);
  assert.match(releaseGate, /head !== receipt\.head_sha/);
  assert.match(releaseGate, /tree !== receipt\.head_tree/);
  assert.match(publisher, /await sql`begin`/);
  assert.match(publisher, /await sql`commit`/);
  assert.match(publisher, /await sql`rollback`/);
  assert.match(publisher, /configuration_pickup_schedule_days/);
  assert.match(publisher, /window_count/);
  assert.match(publisher, /contract_valid/);
  assert.match(main, /writeOperatorReceipt\(operatorReceipt\)/);
  assert.doesNotMatch(main, /MOMI_PREORDER_DATABASE_URL/);
});
