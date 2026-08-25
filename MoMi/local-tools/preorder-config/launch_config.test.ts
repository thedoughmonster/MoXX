import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateConfig } from "./validate_config.ts";
import type { JsonValue } from "./types.ts";

test("checked-in active policies disable self-service changes", async () => {
  const names = ["preorder-menu-launch.json", "preorder-menu-launch-restore.json"];
  const configs = await Promise.all(names.map(async (name) => {
    const path = new URL(
      `../../services/preorder-operations/config/${name}`,
      import.meta.url,
    );
    return await validateConfig(
      JSON.parse(await readFile(path, "utf8")) as JsonValue,
    );
  }));

  for (const config of configs) {
    const policy = config.surface.cancellation_policy;
    assert.equal(config.publication_mode, "active");
    assert.equal(config.surface.enabled, true);
    assert.equal(policy.customer_cancellation_allowed, false);
    assert.equal(policy.customer_modification_allowed, false);
    assert.match(policy.summary, /contact Dough Monster/i);
    assert.match(policy.summary, /self-service changes are not available/i);
  }

  const config = configs[0];
  assert.equal(config.schema_version, 3);
  assert.equal(config.catalog.length, 20);
  assert.ok(config.catalog.every((item) => item.available));
  assert.ok(config.catalog.every((item) => item.preorder_enabled));
  assert.ok(config.catalog.every((item) => item.allergen_status === "unverified"));
  assert.ok(config.catalog.every((item) => item.maximum_quantity === 75));
  assert.deepEqual(config.savings_policy, {
    advance_tiers: [], quantity_levels: [],
  });
  assert.deepEqual(
    config.pickup_policy.schedule_mappings?.map((mapping) => [
      mapping.schedule_key, mapping.iso_weekdays, mapping.starts_local,
      mapping.ends_local,
    ]),
    [["weekday", [1, 2, 3, 4, 5], "07:00", "14:00"],
      ["weekend", [6, 7], "08:00", "14:00"]],
  );
  const smores = config.catalog.find((item) =>
    item.item_id === "cd3d0293-32fb-4b1a-89fe-345bc4a2e6ca"
  );
  assert.equal(smores?.eligibility_mode, "ends_on");
  assert.equal(smores?.eligible_through_date, "2026-08-10");
});
