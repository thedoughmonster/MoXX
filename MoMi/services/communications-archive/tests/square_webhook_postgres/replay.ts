import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { capture } from "./capture.ts";

export async function assertReplayAndConcurrency(sql: Sql): Promise<void> {
  const rawText = JSON.stringify({
    event_id: "square-event-1",
    type: "payment.updated",
  });
  const receipts = await Promise.all([
    capture(
      sql,
      "square-event-1-a",
      "square:webhook:event:square-event-1",
      rawText,
    ),
    capture(
      sql,
      "square-event-1-b",
      "square:webhook:event:square-event-1",
      rawText,
    ),
  ]);
  assert.deepEqual(receipts.map((receipt) => receipt.disposition).sort(), [
    "duplicate",
    "stored",
  ]);
  assert.equal(receipts[0]?.archive_item_id, receipts[1]?.archive_item_id);
  assert.equal(receipts[0]?.content_hash, receipts[1]?.content_hash);

  const [count] = await sql<{ count: number }[]>`
    select count(*)::integer as count
    from momi_communications.archive_items
    where source_type = 'square_payment_webhook'
      and idempotency_key = 'square:webhook:event:square-event-1'`;
  assert.equal(count?.count, 1);

  await assert.rejects(
    capture(
      sql,
      "square-event-1-c",
      "square:webhook:event:square-event-1",
      JSON.stringify({ event_id: "square-event-1", type: "refund.updated" }),
    ),
    /raw evidence replay conflicts/,
  );
}
