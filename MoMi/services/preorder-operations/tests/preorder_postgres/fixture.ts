import assert from "node:assert/strict";

import type { Sql } from "postgres";

export const surfaceId = "10000000-0000-4000-8000-000000000001";
export const itemId = "20000000-0000-4000-8000-000000000002";

type QuoteOptions = {
  avoidedAllergens?: string[];
  capacity?: "available" | "hold_required";
  quantity?: number;
};

export const lifecycleFixture = {
  async seed(sql: Sql): Promise<string> {
    await sql`
      insert into momi_preorder.surfaces (
        surface_id, surface_key, location_id, location_name, timezone,
        surface_version, catalog_version, policy_version, mapping_version,
        cancellation_policy, freshness_seconds, published_at, enabled,
        preorder_policy
      ) values (
        ${surfaceId}::uuid, 'preorder-test',
        '30000000-0000-4000-8000-000000000003'::uuid,
        'Dough Monster Test', 'UTC', 1, 1, 1, 1,
        ${sql.json({
          summary: "Changes are accepted before fulfillment begins.",
          customer_cancellation_allowed: true,
          customer_modification_allowed: true,
        })}::jsonb, 300, clock_timestamp(), true,
        ${sql.json({
          pickup: { horizon_days: 14, daily_start_local: "08:00",
            daily_end_local: "10:00", cutoff_hours: 12, closures: [] },
          savings: { advance_tiers: [
            { minimum_days: 2, multiplier_bps: 100 },
            { minimum_days: 5, multiplier_bps: 200 },
            { minimum_days: 10, multiplier_bps: 300 },
          ], quantity_levels: [
            { minimum_quantity: 1, discount_bps: 100, label: "Test" },
          ] },
          capacity: { daily_limit: 40, limited_threshold: 4 },
        })}::jsonb
      )
    `;
    await sql`
      insert into momi_preorder.catalog_items (
        surface_id, catalog_version, item_id, item_version, category_key,
        name, description, currency, base_price_minor, shop_price_minor,
        price_floor_minor, media, allergens, allergen_status,
        seasonal_eligibility, available, maximum_quantity,
        option_groups, disclosures
      ) values (
        ${surfaceId}::uuid, 1, ${itemId}::uuid, 1, 'test', 'Test Doughnut',
        'Executable preorder lifecycle fixture.', 'USD', 150, 200, 120,
        '[]'::jsonb, '["milk"]'::jsonb, 'verified', 'eligible', true, 20,
        '[]'::jsonb, '[]'::jsonb
      )
    `;
    const [window] = await sql<{ window_id: string }[]>`
      select window_id from momi_preorder.fulfillment_windows
      where surface_id = ${surfaceId}::uuid
      order by fulfillment_date desc limit 1
    `;
    assert.ok(window);
    await sql`update momi_preorder.fulfillment_windows set
      starts_at = clock_timestamp() + interval '3 days',
      ends_at = clock_timestamp() + interval '3 days 2 hours',
      order_cutoff_at = clock_timestamp() + interval '2 days',
      capacity_limit = 40, limited_threshold = 4, enabled = true
      where window_id = ${window.window_id}::uuid`;
    return window.window_id;
  },
  async quote(sql: Sql, windowId: string, options: QuoteOptions = {}) {
    const quoteId = crypto.randomUUID();
    const authority = `checkout-authority-${crypto.randomUUID()}`;
    const quantity = options.quantity ?? 2;
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    const versions = { surface_version: 1, catalog_version: 1,
      policy_version: 1, mapping_version: 1 };
    const request = { command_id: crypto.randomUUID(), surface_id: surfaceId,
      fulfillment_window_id: windowId, versions, cart_version: 1,
      avoided_allergens: options.avoidedAllergens ?? [], lines: [{
        line_id: crypto.randomUUID(), item_id: itemId, item_version: 1,
        quantity, choice_ids: [],
      }] };
    const response = { outcome: "accepted", quote: { quote_id: quoteId,
      quote_version: 1, fulfillment_window_id: windowId, versions,
      capacity_result: options.capacity ?? "available", expires_at: expiresAt,
      revalidation_token: authority } };
    await sql`insert into momi_preorder.quotes (
      quote_id, command_id, request_snapshot, response_snapshot,
      surface_id, fulfillment_window_id, surface_version, catalog_version,
      policy_version, mapping_version, cart_version, requested_quantity,
      line_subtotal_minor, quantity_savings_minor, notice_savings_minor,
      shop_comparison_minor, total_minor, capacity_result, expires_at
    ) values (${quoteId}::uuid, ${request.command_id}::uuid,
      ${sql.json(request)}::jsonb, ${sql.json(response)}::jsonb,
      ${surfaceId}::uuid, ${windowId}::uuid, 1, 1, 1, 1, 1, ${quantity},
      ${150 * quantity}, 0, ${10 * quantity}, ${200 * quantity},
      ${140 * quantity}, ${options.capacity ?? "available"}, ${expiresAt})`;
    return { authority, quoteId };
  },
  async hold(sql: Sql, authority: string, request: Record<string, unknown>) {
    const [row] = await sql<{ result: Record<string, unknown> }[]>`
      select momi_preorder.manage_checkout_hold_v1(
        ${sql.json(request)}::jsonb, ${authority}) as result`;
    assert.ok(row);
    return row.result;
  },
  async order(sql: Sql, authority: string, request: Record<string, unknown>) {
    const [row] = await sql<{ result: Record<string, unknown> }[]>`
      select momi_preorder.create_order_intent_v1(
        ${sql.json(request)}::jsonb, ${authority}) as result`;
    assert.ok(row);
    return row.result;
  },
};
