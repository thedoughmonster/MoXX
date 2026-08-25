import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { itemId, lifecycleFixture, surfaceId } from "./fixture.ts";

export async function assertCurrentAuthority(
  sql: Sql,
  windowId: string,
): Promise<void> {
  const staleQuote = await lifecycleFixture.quote(sql, windowId);
  await sql`update momi_preorder.surfaces set surface_version = 2
    where surface_id = ${surfaceId}::uuid`;
  const staleHold = await lifecycleFixture.hold(sql, staleQuote.authority, {
    command_id: crypto.randomUUID(), action: "create",
    quote_id: staleQuote.quoteId, expected_quote_version: 1,
  });
  assert.equal(
    (staleHold.error as Record<string, unknown>)?.code,
    "stale_version",
  );
  await sql`update momi_preorder.surfaces set surface_version = 1
    where surface_id = ${surfaceId}::uuid`;
  const allergenQuote = await lifecycleFixture.quote(sql, windowId, {
    avoidedAllergens: ["peanuts"],
  });
  await sql`update momi_preorder.catalog_items
    set allergen_status = 'cross_contact_possible'
    where surface_id = ${surfaceId}::uuid and catalog_version = 1
      and item_id = ${itemId}::uuid`;
  const allergenHold = await lifecycleFixture.hold(sql, allergenQuote.authority, {
    command_id: crypto.randomUUID(), action: "create",
    quote_id: allergenQuote.quoteId, expected_quote_version: 1,
  });
  assert.equal(
    (allergenHold.error as Record<string, unknown>)?.code,
    "allergen_unverified",
  );
  const allergenOrder = await lifecycleFixture.order(sql, allergenQuote.authority, {
    command_id: crypto.randomUUID(), quote_id: allergenQuote.quoteId,
    expected_quote_version: 1,
    contact: { name: "Test Customer", email: "customer@example.test" },
  });
  assert.equal(
    (allergenOrder.error as Record<string, unknown>)?.code,
    "allergen_unverified",
  );
  await sql`update momi_preorder.catalog_items set allergen_status = 'verified'
    where surface_id = ${surfaceId}::uuid and catalog_version = 1
      and item_id = ${itemId}::uuid`;
  const closedQuote = await lifecycleFixture.quote(sql, windowId);
  await sql`update momi_preorder.fulfillment_windows set enabled = false
    where window_id = ${windowId}::uuid`;
  const closedOrder = await lifecycleFixture.order(sql, closedQuote.authority, {
    command_id: crypto.randomUUID(), quote_id: closedQuote.quoteId,
    expected_quote_version: 1,
    contact: { name: "Test Customer", email: "customer@example.test" },
  });
  assert.equal(
    (closedOrder.error as Record<string, unknown>)?.code,
    "window_closed",
  );
  await sql`update momi_preorder.fulfillment_windows set enabled = true
    where window_id = ${windowId}::uuid`;
}
