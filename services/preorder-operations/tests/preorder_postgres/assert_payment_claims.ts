import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { lifecycleFixture } from "./fixture.ts";
import { paymentFixture } from "./payment_fixture.ts";

export async function assertPaymentClaims(sql: Sql, windowId: string) {
  const created = await paymentFixture.order(sql, windowId);
  const orderId = String(created.order.order_id);
  const commandId = crypto.randomUUID();
  const request = { command_id: commandId, order_id: orderId,
    expected_order_version: 1 };
  const first = await paymentFixture.claim(sql, request, created.authority);
  assert.equal(first.disposition, "claimed");
  const claim = first.claim as Record<string, unknown>;
  const receipt = first.receipt as Record<string, unknown>;
  assert.equal(receipt.payment_status, "pending");
  assert.equal(receipt.order_version, 2);
  assert.equal(claim.owner_order_id, orderId);
  assert.equal(claim.amount_minor, 280);
  assert.equal(claim.currency, "USD");
  const replay = await paymentFixture.claim(sql, request, created.authority);
  assert.equal(replay.disposition, "busy");
  assert.equal((replay.receipt as Record<string, unknown>).payment_attempt_id,
    receipt.payment_attempt_id);
  const reused = await paymentFixture.claim(sql, { ...request,
    order_id: crypto.randomUUID() }, created.authority);
  assert.equal((reused.error as Record<string, unknown>)?.code, "stale_version");
  const competing = await paymentFixture.claim(sql, {
    command_id: crypto.randomUUID(), order_id: orderId,
    expected_order_version: 2,
  }, created.authority);
  assert.equal(competing.disposition, "busy");
  const [priorCommand] = await sql<{ command_id: string }[]>`
    select command_id from momi_preorder.commands
    where response_snapshot->>'order_id' = ${orderId} limit 1`;
  assert.ok(priorCommand);
  const crossContract = await paymentFixture.claim(sql, {
    command_id: priorCommand.command_id, order_id: orderId,
    expected_order_version: 2,
  }, created.authority);
  assert.equal((crossContract.error as Record<string, unknown>)?.code,
    "stale_version");
  const crossQuote = await lifecycleFixture.quote(sql, windowId);
  const crossPaymentCommand = await lifecycleFixture.hold(
    sql, crossQuote.authority, {
      command_id: commandId, action: "create", quote_id: crossQuote.quoteId,
      expected_quote_version: 1,
    });
  assert.equal((crossPaymentCommand.error as Record<string, unknown>)?.code,
    "stale_version");
  const [count] = await sql<{ count: number }[]>`
    select count(*)::integer as count from momi_preorder.payment_attempts
    where order_id = ${orderId}::uuid`;
  assert.equal(count?.count, 1);

  const racing = await paymentFixture.order(sql, windowId);
  const racingOrder = String(racing.order.order_id);
  const results = await Promise.all([1, 2].map(() => paymentFixture.claim(sql, {
    command_id: crypto.randomUUID(), order_id: racingOrder,
    expected_order_version: 1,
  }, racing.authority)));
  assert.equal(results.filter((result) => result.disposition === "claimed").length, 1);
  assert.equal(results.filter((result) =>
    (result.error as Record<string, unknown> | undefined)?.code ===
      "stale_version").length, 1);
  return { authority: created.authority, claim, receipt, envelope: first };
}
