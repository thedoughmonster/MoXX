import type { JsonValue } from "./types.ts";

export const draftPath = new URL(
  "../../services/preorder-operations/config/preorder-menu-draft.json",
  import.meta.url,
);

export const base = {
  schema_version: 1,
  publication_ref: "70000000-0000-4000-8000-000000000001",
  publication_mode: "active",
  source_evidence: {
    source_system: "toast",
    menu_id: "fb8d9bc6-42c5-4510-8679-541b363cf597",
    source_version_id: "6".repeat(64),
    observed_at: "2026-07-28T20:00:31.912Z",
  },
  surface: {
    surface_id: "4d933f95-c531-41c5-a162-8a48e450ba70",
    surface_key: "preorder",
    location_id: "2bbf45d0-cc3f-47eb-b697-cb68d0abc123",
    location_name: "Dough Monster",
    timezone: "America/New_York",
    enabled: true,
    freshness_seconds: 300,
    cancellation_policy: {
      summary: "Contact the shop.",
      customer_cancellation_allowed: false,
      customer_modification_allowed: false,
    },
  },
  pickup_policy: {
    horizon_days: 14,
    daily_start_local: "08:00",
    daily_end_local: "10:00",
    cutoff_hours: 12,
    closures: [],
  },
  savings_policy: {
    advance_tiers: [{ minimum_days: 2, multiplier_bps: 100 }, {
      minimum_days: 5,
      multiplier_bps: 200,
    }, { minimum_days: 10, multiplier_bps: 300 }],
    quantity_levels: [{
      minimum_quantity: 6,
      discount_bps: 100,
      label: "Level 1",
    }],
  },
  capacity_policy: { daily_limit: 120, limited_threshold: 24 },
  feature_flags: { checkout: false },
  catalog: [{
    item_id: "d11f082b-e0ef-4d6e-9537-45111be658b9",
    item_version: 1,
    category: "Filled Doughnuts",
    name: "Vanilla Joe",
    description: "Espresso creme.",
    currency: "USD",
    shop_price_minor: 160,
    preorder_price_minor: 150,
    price_floor_minor: 120,
    media: [],
    allergens: ["milk"],
    allergen_status: "verified",
    seasonal_eligibility: "eligible",
    available: true,
    maximum_quantity: 24,
    option_groups: [],
    disclosures: [],
  }],
} as JsonValue;
