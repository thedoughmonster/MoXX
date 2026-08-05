import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseCli } from "./parse_cli.ts";
import { base, draftPath } from "./preorder_config_fixture.ts";
import { validateConfig } from "./validate_config.ts";
import type { JsonValue } from "./types.ts";

test("active configuration enforces lower preorder pricing", async () => {
  await assert.doesNotReject(validateConfig(base));
  const malformed = structuredClone(base) as Record<string, unknown>;
  malformed.publication_ref = "not-a-uuid";
  await assert.rejects(
    validateConfig(malformed as JsonValue),
    /must match format "uuid"/,
  );
  const unsafe = structuredClone(base) as Record<string, unknown>;
  const items = unsafe.catalog as Array<Record<string, unknown>>;
  items[0].preorder_price_minor = 160;
  await assert.rejects(
    validateConfig(unsafe as JsonValue),
    /price does not match its class/,
  );
});

test("one safe item cannot mask another unsafe available item", async () => {
  const mixed = structuredClone(base) as Record<string, unknown>;
  const safe = (mixed.catalog as Array<Record<string, unknown>>)[0];
  const unsafe = structuredClone(safe);
  unsafe.item_id = "20000000-0000-4000-8000-000000000001";
  unsafe.allergen_status = "unverified";
  (mixed.catalog as Array<Record<string, unknown>>).push(unsafe);
  await assert.rejects(
    validateConfig(mixed as JsonValue),
    /safe allergen or price evidence/,
  );
});

test("drafts fail closed without invented facts", async () => {
  const draft = structuredClone(base) as Record<string, unknown>;
  draft.publication_mode = "draft";
  const surface = draft.surface as Record<string, unknown>;
  surface.enabled = false;
  const item = (draft.catalog as Array<Record<string, unknown>>)[0];
  item.available = false;
  item.preorder_enabled = false;
  item.allergen_status = "unverified";
  item.price_floor_minor = null;
  const classes = draft.price_classes as Array<Record<string, unknown>>;
  classes[0].price_floor_minor = null;
  await assert.doesNotReject(validateConfig(draft as JsonValue));
});

test("checked-in Toast draft preserves evidence but publishes nothing", async () => {
  const draft = JSON.parse(await readFile(draftPath, "utf8")) as JsonValue;
  const config = await validateConfig(draft);
  assert.equal(config.publication_mode, "draft");
  assert.equal(config.surface.enabled, false);
  assert.equal(config.catalog.length, 19);
  assert.ok(config.catalog.every((item) => !item.available));
  assert.ok(
    config.catalog.every((item) => item.allergen_status === "unverified"),
  );
  assert.deepEqual(
    Object.fromEntries((config.price_classes ?? []).map((priceClass) => [
      priceClass.price_class_key, priceClass.preorder_price_minor,
    ])),
    { classic: 150, iced: 160, honey_bun: 160, iced_sprinkles: 170,
      filled_shell: 180, big_apple_ugly: 350 },
  );
  assert.ok(config.catalog.every((item) => item.preorder_enabled === false));
  assert.ok(config.catalog.every((item) => item.eligibility_mode === "always"));
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
  assert.throws(() =>
    parseCli([
      "--env",
      "prod",
      "--project-ref",
      "xtbraqnlskmqxinjxxdn",
      "--config",
      "draft.json",
      "--actor",
      "operator",
    ]), /does not match/);
});
