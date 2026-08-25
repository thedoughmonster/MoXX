import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { itemId, surfaceId } from "./fixture.ts";

export async function assertPricingEligibility(
  sql: Sql,
  windowId: string,
): Promise<void> {
  const config = {
    schema_version: 2,
    publication_ref: "70000000-0000-4000-8000-000000000901",
    publication_mode: "draft",
    surface: { surface_key: "policy-test", enabled: false },
    price_classes: [{
      price_class_key: "classic",
      label: "Classic",
      currency: "USD",
      preorder_price_minor: 150,
      price_floor_minor: null,
      doughnut_price_class: true,
    }],
    catalog: [{
      item_id: "70000000-0000-4000-8000-000000000902",
      pricing_strategy: "direct_class",
      price_class_key: "classic",
      preorder_price_minor: 150,
      price_floor_minor: null,
      preorder_enabled: false,
      eligibility_mode: "always",
      eligible_from_date: null,
      eligible_through_date: null,
      available: false,
    }],
  };
  const [published] = await sql<{ receipt: Record<string, unknown> }[]>`
    select momi_preorder.publish_configuration_v1(
      ${sql.json(config)}::jsonb, ${"a".repeat(64)}, 'postgres-test'
    ) as receipt`;
  const [replayed] = await sql<{ receipt: Record<string, unknown> }[]>`
    select momi_preorder.publish_configuration_v1(
      ${sql.json(config)}::jsonb, ${"a".repeat(64)}, 'postgres-test'
    ) as receipt`;
  assert.equal(published.receipt.replayed, false);
  assert.equal(replayed.receipt.replayed, true);
  const [stored] = await sql<{ classes: number; policies: number }[]>`
    select
      (select count(*)::integer from
        momi_preorder.configuration_price_classes) as classes,
      (select count(*)::integer from
        momi_preorder.configuration_item_policies) as policies`;
  assert.deepEqual(stored, { classes: 1, policies: 1 });

  const invalid = structuredClone(config);
  invalid.publication_ref = "70000000-0000-4000-8000-000000000903";
  invalid.catalog[0].eligibility_mode = "date_range";
  invalid.catalog[0].eligible_from_date = "2026-08-10";
  invalid.catalog[0].eligible_through_date = "2026-08-09";
  await assert.rejects(
    sql`select momi_preorder.publish_configuration_v1(
      ${sql.json(invalid)}::jsonb, ${"b".repeat(64)}, 'postgres-test'
    )`,
    /invalid versioned preorder authoring policy/,
  );

  const [window] = await sql<{ fulfillment_date: string }[]>`
    select fulfillment_date::text from momi_preorder.fulfillment_windows
    where window_id = ${windowId}::uuid`;
  assert.ok(window);
  await sql`update momi_preorder.catalog_items set
    eligibility_mode = 'starts_on',
    eligible_from_date = ${window.fulfillment_date}::date + 1,
    eligible_through_date = null
    where surface_id = ${surfaceId}::uuid and item_id = ${itemId}::uuid`;
  const [bootstrap] = await sql<{ data: Record<string, unknown> }[]>`
    select momi_preorder.read_bootstrap_v1(
      'preorder-test', ${window.fulfillment_date}::date
    ) as data`;
  const catalog = bootstrap.data.catalog as Array<Record<string, unknown>>;
  assert.equal(catalog[0].available, false);

  const request = {
    command_id: crypto.randomUUID(),
    surface_id: surfaceId,
    fulfillment_window_id: windowId,
    versions: { surface_version: 1, catalog_version: 1,
      policy_version: 1, mapping_version: 1 },
    cart_version: 1,
    avoided_allergens: [],
    lines: [{ line_id: crypto.randomUUID(), item_id: itemId,
      item_version: 1, quantity: 1, choice_ids: [] }],
  };
  const [rejected] = await sql<{ result: Record<string, unknown> }[]>`
    select momi_preorder.create_quote_v1(${sql.json(request)}::jsonb) as result`;
  assert.equal(rejected.result.outcome, "rejected");
  assert.equal((rejected.result.error as Record<string, unknown>).code,
    "item_unavailable");

  await sql`update momi_preorder.catalog_items set
    eligibility_mode = 'always', eligible_from_date = null,
    eligible_through_date = null
    where surface_id = ${surfaceId}::uuid and item_id = ${itemId}::uuid`;
  request.command_id = crypto.randomUUID();
  const [accepted] = await sql<{ result: Record<string, unknown> }[]>`
    select momi_preorder.create_quote_v1(${sql.json(request)}::jsonb) as result`;
  assert.equal(accepted.result.outcome, "accepted");
}
