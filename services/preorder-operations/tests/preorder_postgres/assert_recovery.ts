import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { lifecycleFixture, surfaceId } from "./fixture.ts";

export async function assertRecovery(
  sql: Sql,
  windowId: string,
  order: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const orderId = String(order.order_id);
  const authority = String(order.recovery_authority);
  const [status] = await sql<{ data: Record<string, unknown> | null }[]>`
    select momi_preorder.read_order_status_v1(
      ${orderId}::uuid, ${authority}) as data`;
  assert.deepEqual(status?.data?.allowed_actions, [
    "view_status", "request_cancellation", "request_modification",
  ]);
  assert.equal(
    status?.data?.policy_summary,
    "Changes are accepted before fulfillment begins.",
  );
  const [wrong] = await sql<{ data: unknown }[]>`
    select momi_preorder.read_order_status_v1(
      ${orderId}::uuid, ${`wrong-${crypto.randomUUID()}`}) as data`;
  assert.equal(wrong?.data, null);
  await sql`update momi_preorder.surfaces set cancellation_policy = ${sql.json({
    summary: "A later policy that must not rewrite accepted terms.",
    customer_cancellation_allowed: false,
    customer_modification_allowed: false,
  })}::jsonb where surface_id = ${surfaceId}::uuid`;
  await sql`update momi_preorder.orders set payment_status = 'declined'
    where order_id = ${orderId}::uuid`;
  const [declined] = await sql<{ data: Record<string, unknown> }[]>`
    select momi_preorder.read_order_status_v1(${orderId}::uuid, ${authority}) as data`;
  assert.deepEqual(declined?.data.allowed_actions, ["view_status", "retry_payment",
    "request_cancellation", "request_modification"]);
  assert.equal(declined?.data.policy_summary,
    "Changes are accepted before fulfillment begins.");
  await sql`update momi_preorder.fulfillment_windows
    set order_cutoff_at = clock_timestamp() - interval '1 second'
    where window_id = ${windowId}::uuid`;
  const [afterCutoff] = await sql<{ data: Record<string, unknown> }[]>`
    select momi_preorder.read_order_status_v1(${orderId}::uuid, ${authority}) as data`;
  assert.deepEqual(afterCutoff?.data.allowed_actions, ["view_status"]);
  await sql`update momi_preorder.fulfillment_windows
    set order_cutoff_at = clock_timestamp() + interval '2 days'
    where window_id = ${windowId}::uuid`;
  await sql`update momi_preorder.orders set order_status = 'payment_pending',
    payment_status = 'indeterminate' where order_id = ${orderId}::uuid`;
  const [pending] = await sql<{ data: Record<string, unknown> }[]>`
    select momi_preorder.read_order_status_v1(${orderId}::uuid, ${authority}) as data`;
  assert.deepEqual(pending?.data.allowed_actions, [
    "view_status", "reconcile_payment", "contact_shop",
  ]);
  await sql`update momi_preorder.orders set order_status = 'completed',
    payment_status = 'paid', fulfillment_status = 'completed'
    where order_id = ${orderId}::uuid`;
  const [completed] = await sql<{ data: Record<string, unknown> }[]>`
    select momi_preorder.read_order_status_v1(${orderId}::uuid, ${authority}) as data`;
  assert.deepEqual(completed?.data.allowed_actions, ["view_status"]);

  const consumedQuote = await lifecycleFixture.quote(
    sql, windowId, { capacity: "hold_required" },
  );
  const hold = await lifecycleFixture.hold(sql, consumedQuote.authority, {
    command_id: crypto.randomUUID(), action: "create",
    quote_id: consumedQuote.quoteId, expected_quote_version: 1,
  });
  const consumedOrder = await lifecycleFixture.order(sql, consumedQuote.authority, {
    command_id: crypto.randomUUID(), quote_id: consumedQuote.quoteId,
    expected_quote_version: 1, hold_id: hold.hold_id,
    contact: { name: "Held Customer", phone: "5551234567" },
  });
  assert.equal(consumedOrder.outcome, "accepted");
  const recovery = await lifecycleFixture.hold(sql, consumedQuote.authority, {
    command_id: crypto.randomUUID(), action: "recover",
    quote_id: consumedQuote.quoteId, expected_quote_version: 1,
    hold_id: hold.hold_id,
  });
  assert.equal((recovery.error as Record<string, unknown>)?.code, "stale_version");
  assert.equal(recovery.hold_status, undefined);
  assert.ok(status?.data);
  return status.data;
}
