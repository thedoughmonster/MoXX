import type { QuoteInput } from "./types.ts";

const allergens = new Set([
  "milk",
  "egg",
  "peanuts",
  "tree_nuts",
  "wheat",
  "soy",
  "sesame",
]);

export function parseRequest(value: unknown): QuoteInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const keys = Object.keys(input).sort().join(",");
  if (
    keys !==
      [
        "avoided_allergens",
        "cart_version",
        "command_id",
        "fulfillment_window_id",
        "lines",
        "surface_id",
        "versions",
      ].join(",")
  ) {
    return null;
  }
  if (
    ![input.command_id, input.surface_id, input.fulfillment_window_id]
      .every((item) => typeof item === "string" && uuid.test(item))
  ) return null;
  if (
    !Number.isInteger(input.cart_version) || (input.cart_version as number) < 1
  ) {
    return null;
  }
  const versions = input.versions as Record<string, unknown> | null;
  if (
    !versions || typeof versions !== "object" || Array.isArray(versions) ||
    Object.keys(versions).sort().join(",") !==
      [
        "catalog_version",
        "mapping_version",
        "policy_version",
        "surface_version",
      ].join(",") ||
    !Object.values(versions).every((item) =>
      Number.isInteger(item) && (item as number) >= 1
    )
  ) return null;
  if (
    !Array.isArray(input.avoided_allergens) ||
    new Set(input.avoided_allergens).size !== input.avoided_allergens.length ||
    !input.avoided_allergens.every((item) =>
      typeof item === "string" && allergens.has(item)
    )
  ) return null;
  if (
    !Array.isArray(input.lines) || input.lines.length < 1 ||
    input.lines.length > 50
  ) return null;
  const lineIds = input.lines.map((candidate) =>
    candidate && typeof candidate === "object" && !Array.isArray(candidate)
      ? (candidate as Record<string, unknown>).line_id
      : null
  );
  if (new Set(lineIds).size !== lineIds.length) return null;
  if (
    !input.lines.every((candidate) => {
      if (
        !candidate || typeof candidate !== "object" || Array.isArray(candidate)
      ) {
        return false;
      }
      const line = candidate as Record<string, unknown>;
      return Object.keys(line).sort().join(",") ===
          ["choice_ids", "item_id", "item_version", "line_id", "quantity"].join(
            ",",
          ) &&
        typeof line.line_id === "string" && uuid.test(line.line_id) &&
        typeof line.item_id === "string" && uuid.test(line.item_id) &&
        Number.isInteger(line.item_version) &&
        (line.item_version as number) >= 1 &&
        Number.isInteger(line.quantity) && (line.quantity as number) >= 1 &&
        (line.quantity as number) <= 100 && Array.isArray(line.choice_ids) &&
        new Set(line.choice_ids).size === line.choice_ids.length &&
        line.choice_ids.every((item) =>
          typeof item === "string" && uuid.test(item)
        );
    })
  ) return null;
  return input as QuoteInput;
}
