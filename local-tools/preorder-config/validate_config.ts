import { readFile } from "node:fs/promises";

import Ajv2020 from "ajv/dist/2020.js";

import type { JsonValue, PreorderConfiguration } from "./types.ts";

const schemaUrl = new URL(
  "../../services/preorder-operations/config/preorder-configuration-v1.schema.json",
  import.meta.url,
);

export async function validateConfig(
  value: JsonValue,
): Promise<PreorderConfiguration> {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8")) as object;
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });
  ajv.addFormat("uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
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
  const available = config.catalog.filter((item) => item.available);
  if (available.length === 0) {
    throw new Error("Active configuration needs an available item");
  }
  for (const item of available) {
    if (
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
