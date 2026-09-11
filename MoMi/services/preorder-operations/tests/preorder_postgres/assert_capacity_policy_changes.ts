import assert from "node:assert/strict";
import type { Sql } from "postgres";
import { launchConfig, launchItemId, launchSurfaceId } from "./launch_policy_fixture.ts";
export async function assertCapacityPolicyChanges(sql: Sql): Promise<void> {
  const [before] = await sql`
    select w.window_id, w.fulfillment_date::text as date, surface.* from
      momi_preorder.fulfillment_windows w
    join momi_preorder.surfaces surface using (surface_id) join
      momi_preorder.fulfillment_capacity capacity using (surface_id, fulfillment_date)
    where w.surface_id = ${launchSurfaceId}::uuid and
      w.policy_version = surface.policy_version
      and capacity.held_quantity + capacity.committed_quantity = 0
    order by w.fulfillment_date desc limit 1`;
  const versions = { surface_version: before.surface_version, catalog_version: before.catalog_version,
    policy_version: before.policy_version,
    mapping_version: before.mapping_version };
  const quoteRequest = { command_id: crypto.randomUUID(), surface_id: launchSurfaceId,
    fulfillment_window_id: before.window_id,
    versions, cart_version: 1, avoided_allergens: [], lines: [{ line_id: crypto.randomUUID(),
      item_id: launchItemId, item_version: 1,
      quantity: 75, choice_ids: [] }] };
  const [oldQuoteRow] = await sql`select momi_preorder.create_quote_v1(${sql.json(quoteRequest)}::jsonb) result`;
  const oldQuote = oldQuoteRow.result.quote;
  const holdRequest = { command_id: crypto.randomUUID(), action: "create",
    quote_id: oldQuote.quote_id, expected_quote_version: 1 };
  const [oldHoldRow] = await sql`select momi_preorder.manage_checkout_hold_v1(${sql.json(holdRequest)}::jsonb, ${oldQuote.revalidation_token}) result`;
  const orderRequest = { command_id: crypto.randomUUID(), quote_id: oldQuote.quote_id,
    expected_quote_version: 1, hold_id: oldHoldRow.result.hold_id,
    contact: { name: "Capacity Test", email: "capacity@example.test" } };
  const [oldOrderRow] = await sql`select momi_preorder.create_order_intent_v1(${sql.json(orderRequest)}::jsonb, ${oldQuote.revalidation_token}) result`;
  assert.equal(oldOrderRow.result.outcome, "accepted");
  const increased = structuredClone(launchConfig);
  increased.publication_ref = "71000000-0000-4000-8000-000000000009";
  increased.capacity_policy.daily_limit = 100;
  await sql`select momi_preorder.publish_configuration_v1(${sql.json(increased)}::jsonb, ${"7".repeat(64)}, 'postgres-test')`;
  const [current] = await sql`select w.window_id, surface.* from
    momi_preorder.fulfillment_windows w join momi_preorder.surfaces surface
      using (surface_id) where w.surface_id = ${launchSurfaceId}::uuid and
      w.policy_version = surface.policy_version
      and w.fulfillment_date = ${before.date}::date`;
  const currentVersions = { surface_version: current.surface_version,
    catalog_version: current.catalog_version, policy_version: current.policy_version,
    mapping_version: current.mapping_version };
  const quotes = [];
  for (const quantity of [1, 23]) {
    const request = { command_id: crypto.randomUUID(), surface_id: launchSurfaceId,
      fulfillment_window_id: current.window_id, versions: currentVersions,
      cart_version: 1, avoided_allergens: [], lines: [{ line_id: crypto.randomUUID(),
        item_id: launchItemId, item_version: 1, quantity, choice_ids: [] }] };
    const [row] = await sql`select momi_preorder.create_quote_v1(
      ${sql.json(request)}::jsonb) as result`;
    assert.equal(row.result.outcome, "accepted", JSON.stringify(row.result));
    quotes.push(row.result.quote);
  }
  const firstHold = { command_id: crypto.randomUUID(), action: "create",
    quote_id: quotes[0].quote_id, expected_quote_version: 1 };
  const firstResults = await Promise.all([1, 2].map(() => sql`
    select momi_preorder.manage_checkout_hold_v1(${sql.json(firstHold)}::jsonb,
      ${quotes[0].revalidation_token}) as result`));
  assert.deepEqual(firstResults[0][0].result, firstResults[1][0].result);
  const [usage76] = await sql`select held_quantity + committed_quantity as total
    from momi_preorder.fulfillment_capacity where surface_id = ${launchSurfaceId}::uuid
      and fulfillment_date = ${before.date}::date`;
  assert.equal(usage76.total, 76);
  await sql`select momi_preorder.manage_checkout_hold_v1(${sql.json({
    command_id: crypto.randomUUID(), action: "create", quote_id: quotes[1].quote_id,
    expected_quote_version: 1 })}::jsonb, ${quotes[1].revalidation_token})`;
  const nearLimitQuotes = [];
  for (const quantity of [1, 1]) {
    const request = { command_id: crypto.randomUUID(), surface_id: launchSurfaceId,
      fulfillment_window_id: current.window_id, versions: currentVersions,
      cart_version: 1, avoided_allergens: [], lines: [{ line_id: crypto.randomUUID(),
        item_id: launchItemId, item_version: 1, quantity, choice_ids: [] }] };
    const [row] = await sql`select momi_preorder.create_quote_v1(
      ${sql.json(request)}::jsonb) as result`;
    nearLimitQuotes.push(row.result.quote);
  }
  const admissions = await Promise.all(nearLimitQuotes.map((quote) => sql`
    select momi_preorder.manage_checkout_hold_v1(${sql.json({
      command_id: crypto.randomUUID(), action: "create", quote_id: quote.quote_id,
      expected_quote_version: 1 })}::jsonb, ${quote.revalidation_token}) as result`));
  assert.equal(admissions.filter((row) => row[0].result.outcome === "accepted").length, 1);
  const [full] = await sql`select held_quantity + committed_quantity as total
    from momi_preorder.fulfillment_capacity where surface_id = ${launchSurfaceId}::uuid
      and fulfillment_date = ${before.date}::date`;
  assert.equal(full.total, 100);
  const lowered = structuredClone(increased);
  lowered.publication_ref = "71000000-0000-4000-8000-00000000000a";
  lowered.capacity_policy.daily_limit = 50;
  await sql`select momi_preorder.publish_configuration_v1(
    ${sql.json(lowered)}::jsonb, ${"8".repeat(64)}, 'postgres-test')`;
  const [loweredWindow] = await sql`select w.window_id, surface.* from
    momi_preorder.fulfillment_windows w join momi_preorder.surfaces surface
      using (surface_id) where w.surface_id = ${launchSurfaceId}::uuid and
      w.policy_version = surface.policy_version
      and w.fulfillment_date = ${before.date}::date`;
  const rejected = { command_id: crypto.randomUUID(), surface_id: launchSurfaceId,
    fulfillment_window_id: loweredWindow.window_id, versions: {
      surface_version: loweredWindow.surface_version,
      catalog_version: loweredWindow.catalog_version, policy_version: loweredWindow.policy_version,
      mapping_version: loweredWindow.mapping_version }, cart_version: 1,
    avoided_allergens: [], lines: [{ line_id: crypto.randomUUID(),
      item_id: launchItemId, item_version: 1, quantity: 1, choice_ids: [] }] };
  const [rejectedRow] = await sql`select momi_preorder.create_quote_v1(
    ${sql.json(rejected)}::jsonb) as result`;
  assert.equal(rejectedRow.result.error.code, "capacity_unavailable");
  const [bootstrap] = await sql`select momi_preorder.read_bootstrap_v1(
    'launch-test', ${before.date}::date) as result`;
  assert.equal(bootstrap.result.fulfillment_windows[0].availability, "sold_out");
  await sql`update momi_preorder.orders set capacity_expires_at =
    clock_timestamp() - interval '1 second' where order_id =
    ${oldOrderRow.result.order_id}::uuid`;
  const expired = await Promise.all([1, 2].map(() => sql`
    select momi_preorder.expire_abandoned_orders_v1() as count`));
  assert.equal(expired[0][0].count + expired[1][0].count, 1);
  const [released] = await sql`select held_quantity + committed_quantity as total
    from momi_preorder.fulfillment_capacity where surface_id = ${launchSurfaceId}::uuid
      and fulfillment_date = ${before.date}::date`;
  assert.equal(released.total, 25);
}
