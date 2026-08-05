import type { PreorderConfiguration } from "./types.ts";

export function validatePricingPolicy(config: PreorderConfiguration): void {
  if (config.schema_version !== 2) return;
  const classes = config.price_classes ?? [];
  const keys = classes.map((priceClass) => priceClass.price_class_key);
  if (new Set(keys).size !== keys.length) {
    throw new Error("Price class keys must be unique");
  }
  const byKey = new Map(keys.map((key, index) => [key, classes[index]]));
  const doughnut = classes.filter((priceClass) =>
    priceClass.doughnut_price_class
  );
  const highest = Math.max(...doughnut.map((priceClass) =>
    priceClass.preorder_price_minor
  ));
  const highestClasses = doughnut.filter((priceClass) =>
    priceClass.preorder_price_minor === highest
  );
  if (highestClasses.length !== 1) {
    throw new Error("Exactly one highest active doughnut price class is required");
  }
  for (const item of config.catalog) {
    const priceClass = item.pricing_strategy ===
        "highest_active_doughnut_class"
      ? highestClasses[0]
      : byKey.get(item.price_class_key ?? "");
    if (!priceClass) {
      throw new Error(`Item ${item.item_id} has no price class`);
    }
    if (
      item.preorder_price_minor !== priceClass.preorder_price_minor ||
      item.price_floor_minor !== priceClass.price_floor_minor
    ) {
      throw new Error(`Item ${item.item_id} price does not match its class`);
    }
    if (
      item.eligibility_mode === "date_range" &&
      (item.eligible_from_date ?? "") > (item.eligible_through_date ?? "")
    ) {
      throw new Error(`Item ${item.item_id} has an invalid eligibility range`);
    }
  }
}
