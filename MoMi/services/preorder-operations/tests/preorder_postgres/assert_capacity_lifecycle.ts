import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { lifecycleFixture } from "./fixture.ts";

export async function assertCapacityLifecycle(
  sql: Sql,
  windowId: string,
): Promise<void> {
  const abandonedQuote = await lifecycleFixture.quote(sql, windowId);
  const abandoned = await lifecycleFixture.order(sql, abandonedQuote.authority, {
    command_id: crypto.randomUUID(), quote_id: abandonedQuote.quoteId,
    expected_quote_version: 1,
    contact: { name: "Capacity Test", email: "capacity@example.test" },
  });
  const abandonedId = String(abandoned.order_id);
  await sql`update momi_preorder.orders set
    capacity_expires_at = clock_timestamp() - interval '1 second'
    where order_id = ${abandonedId}::uuid`;
  const [before] = await sql<{ committed: number }[]>`
    select committed_quantity as committed
    from momi_preorder.fulfillment_windows
    where window_id = ${windowId}::uuid`;
  const [first] = await sql<{ count: number }[]>`
    select momi_preorder.expire_abandoned_orders_v1() as count`;
  const [replay] = await sql<{ count: number }[]>`
    select momi_preorder.expire_abandoned_orders_v1() as count`;
  const [after] = await sql<{ committed: number }[]>`
    select committed_quantity as committed
    from momi_preorder.fulfillment_windows
    where window_id = ${windowId}::uuid`;
  assert.equal(first.count, 1);
  assert.equal(replay.count, 0);
  assert.equal(after.committed, before.committed - 2);

  const pendingQuote = await lifecycleFixture.quote(sql, windowId);
  const pending = await lifecycleFixture.order(sql, pendingQuote.authority, {
    command_id: crypto.randomUUID(), quote_id: pendingQuote.quoteId,
    expected_quote_version: 1,
    contact: { name: "Payment Test", email: "payment@example.test" },
  });
  const pendingId = String(pending.order_id);
  await sql`update momi_preorder.orders set
    order_status = 'payment_pending', payment_status = 'pending',
    capacity_expires_at = clock_timestamp() - interval '1 second'
    where order_id = ${pendingId}::uuid`;
  const [protectedCount] = await sql<{ count: number }[]>`
    select momi_preorder.expire_abandoned_orders_v1() as count`;
  assert.equal(protectedCount.count, 0);
  for (const paymentStatus of ["authorized", "indeterminate"] as const) {
    await sql`update momi_preorder.orders set payment_status = ${paymentStatus}
      where order_id = ${pendingId}::uuid`;
    const [protectedReplay] = await sql<{ count: number }[]>`
      select momi_preorder.expire_abandoned_orders_v1() as count`;
    assert.equal(protectedReplay.count, 0);
  }

  await sql`update momi_preorder.orders set payment_status = 'paid'
    where order_id = ${abandonedId}::uuid`;
  const [late] = await sql<{ status: string; released: boolean }[]>`
    select order_status as status, capacity_released_at is not null as released
    from momi_preorder.orders where order_id = ${abandonedId}::uuid`;
  const [unchanged] = await sql<{ committed: number }[]>`
    select committed_quantity as committed
    from momi_preorder.fulfillment_windows
    where window_id = ${windowId}::uuid`;
  assert.deepEqual(late, { status: "attention_required", released: true });
  assert.equal(unchanged.committed, after.committed + 2);
}
