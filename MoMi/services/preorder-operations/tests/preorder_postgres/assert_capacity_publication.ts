import assert from "node:assert/strict";
import type { Sql } from "postgres";
import { launchConfig, launchItemId, launchSurfaceId } from "./launch_policy_fixture.ts";

export async function assertCapacityPublication(
  sql: Sql, fulfillmentDate: string, orderId: string,
): Promise<void> {
  const [window] = await sql`
    select window_id from momi_preorder.fulfillment_windows
    where surface_id = ${launchSurfaceId}::uuid and policy_version = 3
      and fulfillment_date = ${fulfillmentDate}::date`;
  const [quoted] = await sql`select momi_preorder.create_quote_v1(${sql.json({
    command_id: crypto.randomUUID(), surface_id: launchSurfaceId,
    fulfillment_window_id: window.window_id,
    versions: { surface_version: 3, catalog_version: 3,
      policy_version: 3, mapping_version: 3 }, cart_version: 1,
    avoided_allergens: [], lines: [{ line_id: crypto.randomUUID(),
      item_id: launchItemId, item_version: 1, quantity: 1, choice_ids: [] }],
  })}::jsonb) as result`;
  assert.equal(quoted.result.outcome, "accepted", JSON.stringify(quoted.result));
  const quote = quoted.result.quote;
  const [held] = await sql`select momi_preorder.manage_checkout_hold_v1(${sql.json({
    command_id: crypto.randomUUID(), action: "create", quote_id: quote.quote_id,
    expected_quote_version: 1,
  })}::jsonb, ${quote.revalidation_token}) as result`;
  assert.equal(held.result.outcome, "accepted");
  await sql`update momi_preorder.orders set
    capacity_expires_at = clock_timestamp() - interval '1 second'
    where order_id = ${orderId}::uuid`;
  const next = structuredClone(launchConfig);
  next.publication_ref = "71000000-0000-4000-8000-000000000008";
  const results = await Promise.all([
    sql`select momi_preorder.publish_configuration_v1(
      ${sql.json(next)}::jsonb, ${"f".repeat(64)}, 'postgres-test') as result`,
    sql`select momi_preorder.expire_abandoned_orders_v1() as count`,
    sql`select momi_preorder.expire_abandoned_orders_v1() as count`,
    sql`select momi_preorder.publish_configuration_v1(
      ${sql.json(next)}::jsonb, ${"f".repeat(64)}, 'postgres-test') as result`,
  ]);
  assert.equal(results[1][0].count + results[2][0].count, 1);
  assert.deepEqual([results[0][0].result.replayed, results[3][0].result.replayed]
    .sort(), [false, true]);
  const release = { command_id: crypto.randomUUID(), action: "release",
    quote_id: quote.quote_id, expected_quote_version: 1,
    hold_id: held.result.hold_id };
  const [beforeRelease] = await sql`
    select count(*)::integer as versions,
      min(held_quantity)::integer as held_min, max(held_quantity)::integer as held_max,
      min(committed_quantity)::integer as committed_min,
      max(committed_quantity)::integer as committed_max
    from momi_preorder.fulfillment_windows
    where surface_id = ${launchSurfaceId}::uuid
      and fulfillment_date = ${fulfillmentDate}::date`;
  assert.deepEqual(beforeRelease, { versions: 3, held_min: 0, held_max: 1,
    committed_min: 0, committed_max: 47 });
  const releases = await Promise.all([
    sql`select momi_preorder.manage_checkout_hold_v1(
      ${sql.json(release)}::jsonb, ${quote.revalidation_token}) as result`,
    sql`select momi_preorder.manage_checkout_hold_v1(
      ${sql.json(release)}::jsonb, ${quote.revalidation_token}) as result`,
  ]);
  assert.deepEqual(releases[0][0].result, releases[1][0].result);
  assert.equal(releases[0][0].result.hold_status, "released");
  const counters = await sql`
    select 'window' as source, held_quantity, committed_quantity
    from momi_preorder.fulfillment_windows
    where surface_id = ${launchSurfaceId}::uuid
      and fulfillment_date = ${fulfillmentDate}::date
    union all select 'capacity', held_quantity, committed_quantity
    from momi_preorder.fulfillment_capacity
    where surface_id = ${launchSurfaceId}::uuid
      and fulfillment_date = ${fulfillmentDate}::date`;
  assert.equal(counters.length, 4);
  const capacity = counters.find((counter) => counter.source === 'capacity');
  const windows = counters.filter((counter) => counter.source === 'window');
  assert.deepEqual(capacity, { source: "capacity", held_quantity: 0,
    committed_quantity: 47 });
  assert.equal(windows.reduce((sum, counter) =>
    sum + counter.held_quantity, 0), 0);
  assert.equal(windows.reduce((sum, counter) =>
    sum + counter.committed_quantity, 0), 47);
}
