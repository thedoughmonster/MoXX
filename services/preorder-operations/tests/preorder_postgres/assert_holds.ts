import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { lifecycleFixture } from "./fixture.ts";

export async function assertHolds(
  sql: Sql,
  windowId: string,
): Promise<Record<string, unknown>> {
  const concurrentQuote = await lifecycleFixture.quote(sql, windowId);
  const request = (commandId: string) => ({
    command_id: commandId, action: "create",
    quote_id: concurrentQuote.quoteId, expected_quote_version: 1,
  });
  const [holdA, holdB] = await Promise.all([
    lifecycleFixture.hold(sql, concurrentQuote.authority,
      request(crypto.randomUUID())),
    lifecycleFixture.hold(sql, concurrentQuote.authority,
      request(crypto.randomUUID())),
  ]);
  assert.equal(holdA.outcome, "accepted");
  assert.deepEqual(holdB.hold_id, holdA.hold_id);
  const [heldOnce] = await sql<{ held_quantity: number }[]>`
    select held_quantity from momi_preorder.fulfillment_windows
    where window_id = ${windowId}::uuid`;
  assert.equal(heldOnce?.held_quantity, 2);
  const replayRequest = request(crypto.randomUUID());
  const replayFirst = await lifecycleFixture.hold(
    sql, concurrentQuote.authority, replayRequest,
  );
  const replaySecond = await lifecycleFixture.hold(
    sql, concurrentQuote.authority, replayRequest,
  );
  assert.deepEqual(replaySecond, replayFirst);
  const release = await lifecycleFixture.hold(sql, concurrentQuote.authority, {
    command_id: crypto.randomUUID(), action: "release",
    quote_id: concurrentQuote.quoteId, expected_quote_version: 1,
    hold_id: holdA.hold_id,
  });
  assert.equal(release.hold_status, "released");
  const releasedAgain = await lifecycleFixture.hold(
    sql,
    concurrentQuote.authority,
    { command_id: crypto.randomUUID(), action: "release",
      quote_id: concurrentQuote.quoteId, expected_quote_version: 1,
      hold_id: holdA.hold_id },
  );
  assert.equal(releasedAgain.hold_status, "released");
  const expiringQuote = await lifecycleFixture.quote(sql, windowId);
  const expiringHold = await lifecycleFixture.hold(sql, expiringQuote.authority, {
    command_id: crypto.randomUUID(), action: "create",
    quote_id: expiringQuote.quoteId, expected_quote_version: 1,
  });
  await sql`update momi_preorder.checkout_holds
    set expires_at = clock_timestamp() - interval '1 second'
    where hold_id = ${String(expiringHold.hold_id)}::uuid`;
  const expired = await lifecycleFixture.hold(sql, expiringQuote.authority, {
    command_id: crypto.randomUUID(), action: "expire",
    quote_id: expiringQuote.quoteId, expected_quote_version: 1,
    hold_id: expiringHold.hold_id,
  });
  assert.equal(expired.hold_status, "expired");
  const [capacity] = await sql<{ held_quantity: number }[]>`
    select held_quantity from momi_preorder.fulfillment_windows
    where window_id = ${windowId}::uuid`;
  assert.equal(capacity?.held_quantity, 0);
  return release;
}
