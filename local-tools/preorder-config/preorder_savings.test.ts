import assert from "node:assert/strict";
import test from "node:test";

import { base } from "./preorder_config_fixture.ts";
import { validateConfig } from "./validate_config.ts";
import type { JsonValue } from "./types.ts";

test("active savings improve monotonically", async () => {
  const advance = structuredClone(base) as Record<string, unknown>;
  const advancePolicy = (advance.savings_policy as Record<string, unknown>)
    .advance_tiers as Array<Record<string, unknown>>;
  advancePolicy[2].multiplier_bps = 50;
  await assert.rejects(validateConfig(advance as JsonValue), /Advance savings/);

  const quantity = structuredClone(base) as Record<string, unknown>;
  const policy = quantity.savings_policy as Record<string, unknown>;
  (policy.quantity_levels as Array<Record<string, unknown>>).push({
    minimum_quantity: 12,
    discount_bps: 50,
    label: "Level 2",
  });
  await assert.rejects(
    validateConfig(quantity as JsonValue),
    /Quantity savings/,
  );
});
