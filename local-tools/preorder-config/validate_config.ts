import { readFile } from "node:fs/promises";

import Ajv2020 from "ajv/dist/2020.js";

import type { JsonValue, PreorderConfiguration } from "./types.ts";
import { validatePricingPolicy } from "./validate_pricing_policy.ts";

const schemaV1 = new URL("../../services/preorder-operations/config/preorder-configuration-v1.schema.json", import.meta.url);
const schemaV2 = new URL("../../services/preorder-operations/config/preorder-configuration-v2.schema.json", import.meta.url);

export async function validateConfig(
  value: JsonValue,
): Promise<PreorderConfiguration> {
  const version = (value as { schema_version?: unknown }).schema_version;
  const schema = JSON.parse(await readFile(version === 2 ? schemaV2 : schemaV1, "utf8")) as object;
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });
  ajv.addFormat(
    "uuid",
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  ajv.addFormat("date", /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/);
  ajv.addFormat("date-time", (value) => !Number.isNaN(Date.parse(value)));
  const validate = ajv.compile(schema);
  if (!validate(value)) {
    throw new Error(
      `Invalid configuration: ${ajv.errorsText(validate.errors)}`,
    );
  }
  const config = value as PreorderConfiguration;
  const ids = config.catalog.map((item) => item.item_id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Catalog item IDs must be unique");
  }
  validatePricingPolicy(config);
  if (config.publication_mode === "draft") {
    if (config.surface.enabled) {
      throw new Error("Draft configuration cannot enable a surface");
    }
    return config;
  }
  if (!config.surface.enabled) {
    throw new Error("Active configuration must enable its surface");
  }
  if (
    config.pickup_policy.cutoff_hours === null ||
    config.capacity_policy.daily_limit === null ||
    config.capacity_policy.limited_threshold === null
  ) {
    throw new Error("Active configuration requires cutoff and capacity values");
  }
  if (
    config.capacity_policy.limited_threshold >
      config.capacity_policy.daily_limit
  ) {
    throw new Error("Limited threshold cannot exceed daily capacity");
  }
  if (
    config.savings_policy.advance_tiers.map((tier) => tier.minimum_days).join(
        ",",
      ) !== "2,5,10" ||
    config.savings_policy.advance_tiers.some((tier) =>
      tier.multiplier_bps === null
    ) ||
    config.savings_policy.quantity_levels.length === 0 ||
    config.savings_policy.quantity_levels.some((level) =>
      level.discount_bps === null
    )
  ) {
    throw new Error(
      "Active configuration requires 2/5/10-day and quantity savings",
    );
  }
  const advance = config.savings_policy.advance_tiers.map((tier) =>
    tier.multiplier_bps as number
  );
  if (advance.some((value, index) => index > 0 && value < advance[index - 1])) {
    throw new Error("Advance savings must improve at 2, 5, and 10 days");
  }
  const quantity = [...config.savings_policy.quantity_levels].sort((a, b) =>
    a.minimum_quantity - b.minimum_quantity
  );
  if (
    quantity.some((level, index) =>
      index > 0 && (
        level.minimum_quantity === quantity[index - 1].minimum_quantity ||
        (level.discount_bps as number) <
          (quantity[index - 1].discount_bps as number)
      )
    )
  ) {
    throw new Error("Quantity savings thresholds must be unique and monotonic");
  }
  const available = config.catalog.filter((item) => item.available);
  if (available.length === 0) {
    throw new Error("Active configuration needs an available item");
  }
  for (const item of available) {
    if (
      (config.schema_version === 2 && !item.preorder_enabled) ||
      item.allergen_status === "unverified" ||
      item.preorder_price_minor === null ||
      item.price_floor_minor === null ||
      item.price_floor_minor > item.preorder_price_minor ||
      item.preorder_price_minor >= item.shop_price_minor ||
      item.maximum_quantity < 1
    ) {
      throw new Error(
        `Available item ${item.item_id} lacks safe allergen or price evidence`,
      );
    }
  }
  return config;
}
