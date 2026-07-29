import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseCli } from "./parse_cli.ts";
import { validateConfig } from "./validate_config.ts";
import type { JsonValue } from "./types.ts";

const draftPath = new URL("../../services/preorder-operations/config/preorder-menu-draft.json", import.meta.url);

const base = {
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

test("active configuration enforces lower preorder pricing", async () => {
  await assert.doesNotReject(validateConfig(base));
  const malformed = structuredClone(base) as Record<string, unknown>;
  malformed.publication_ref = "not-a-uuid";
  await assert.rejects(validateConfig(malformed as JsonValue), /must match format "uuid"/);
  const unsafe = structuredClone(base) as Record<string, unknown>;
  const items = unsafe.catalog as Array<Record<string, unknown>>;
  items[0].preorder_price_minor = 160;
  await assert.rejects(validateConfig(unsafe as JsonValue), /safe allergen or price evidence/);
});

test("one safe item cannot mask another unsafe available item", async () => {
  const mixed = structuredClone(base) as Record<string, unknown>;
  const safe = (mixed.catalog as Array<Record<string, unknown>>)[0];
  const unsafe = structuredClone(safe);
  unsafe.item_id = "20000000-0000-4000-8000-000000000001";
  unsafe.allergen_status = "unverified";
  (mixed.catalog as Array<Record<string, unknown>>).push(unsafe);
  await assert.rejects(validateConfig(mixed as JsonValue), /safe allergen or price evidence/);
});

test("drafts fail closed without invented facts", async () => {
  const draft = structuredClone(base) as Record<string, unknown>;
  draft.publication_mode = "draft";
  const surface = draft.surface as Record<string, unknown>;
  surface.enabled = false;
  const item = (draft.catalog as Array<Record<string, unknown>>)[0];
  item.available = false;
  item.allergen_status = "unverified";
  item.preorder_price_minor = null;
  item.price_floor_minor = null;
  await assert.doesNotReject(validateConfig(draft as JsonValue));
});

test("checked-in Toast draft preserves evidence but publishes nothing", async () => {
  const draft = JSON.parse(await readFile(draftPath, "utf8")) as JsonValue;
  const config = await validateConfig(draft);
  assert.equal(config.publication_mode, "draft");
  assert.equal(config.surface.enabled, false);
  assert.equal(config.catalog.length, 19);
  assert.ok(config.catalog.every((item) => !item.available));
  assert.ok(config.catalog.every((item) => item.allergen_status === "unverified"));
  assert.ok(config.catalog.every((item) => item.preorder_price_minor === null));
  assert.ok(config.catalog.every((item) => item.price_floor_minor === null));
});

test("CLI defaults to dry-run and requires exact target identity", () => {
  const options = parseCli([
    "--",
    "--env",
    "dev",
    "--project-ref",
    "xtbraqnlskmqxinjxxdn",
    "--config",
    "draft.json",
    "--actor",
    "operator",
  ]);
  assert.equal(options.execute, false);
  assert.throws(() => parseCli(["--env", "dev"]), /Required option missing/);
  assert.throws(() => parseCli([
    "--env", "prod", "--project-ref", "xtbraqnlskmqxinjxxdn",
    "--config", "draft.json", "--actor", "operator",
  ]), /does not match/);
});
