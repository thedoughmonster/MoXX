import assert from "node:assert/strict";
import test from "node:test";

import { base } from "./preorder_config_fixture.ts";
import { validateConfig } from "./validate_config.ts";
import type { JsonValue } from "./types.ts";

test("launch savings stay disabled", async () => {
  const advance = structuredClone(base) as Record<string, unknown>;
  const advancePolicy = (advance.savings_policy as Record<string, unknown>)
    .advance_tiers as Array<Record<string, unknown>>;
  advancePolicy.push({ minimum_days: 2, multiplier_bps: 0 });
  await assert.rejects(validateConfig(advance as JsonValue), /must NOT have more than 0 items/);

  const quantity = structuredClone(base) as Record<string, unknown>;
  const policy = quantity.savings_policy as Record<string, unknown>;
  (policy.quantity_levels as Array<Record<string, unknown>>).push(
    { minimum_quantity: 12, discount_bps: 0, label: "Level 1" },
  );
  await assert.rejects(
    validateConfig(quantity as JsonValue),
    /must NOT have more than 0 items/,
  );
});
