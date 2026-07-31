import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { lifecycleFixture } from "./fixture.ts";

export async function assertOrders(
  sql: Sql,
  windowId: string,
): Promise<Record<string, unknown>> {
  const quote = await lifecycleFixture.quote(sql, windowId);
  const request = (commandId: string) => ({
    command_id: commandId, quote_id: quote.quoteId, expected_quote_version: 1,
    contact: { name: "Test Customer", email: "customer@example.test" },
  });
  const commandId = crypto.randomUUID();
  const first = await lifecycleFixture.order(sql, quote.authority, request(commandId));
  const replay = await lifecycleFixture.order(sql, quote.authority, request(commandId));
  assert.deepEqual(replay, first);
  const competing = await lifecycleFixture.order(
    sql, quote.authority, request(crypto.randomUUID()),
  );
  assert.equal(
    (competing.error as Record<string, unknown>)?.code,
    "stale_version",
  );
  const [count] = await sql<{ count: number }[]>`
    select count(*)::integer as count from momi_preorder.orders
    where quote_id = ${quote.quoteId}::uuid`;
  assert.equal(count?.count, 1);
  assert.equal(String(first.recovery_authority).length, 64);

  const racingQuote = await lifecycleFixture.quote(sql, windowId);
  const racingRequest = (racingCommand: string) => ({
    command_id: racingCommand, quote_id: racingQuote.quoteId,
    expected_quote_version: 1,
    contact: { name: "Racing Customer", phone: "5551234567" },
  });
  const results = await Promise.all([
    lifecycleFixture.order(sql, racingQuote.authority,
      racingRequest(crypto.randomUUID())),
    lifecycleFixture.order(sql, racingQuote.authority,
      racingRequest(crypto.randomUUID())),
  ]);
  assert.equal(results.filter((result) => result.outcome === "accepted").length, 1);
  assert.equal(results.filter((result) =>
    (result.error as Record<string, unknown> | undefined)?.code ===
      "stale_version"
  ).length, 1);
  const [racingCount] = await sql<{ count: number }[]>`
    select count(*)::integer as count from momi_preorder.orders
    where quote_id = ${racingQuote.quoteId}::uuid`;
  assert.equal(racingCount?.count, 1);

  const crossContractQuote = await lifecycleFixture.quote(sql, windowId);
  const reusedCommand = crypto.randomUUID();
  const crossContract = await Promise.all([
    lifecycleFixture.hold(sql, crossContractQuote.authority, {
      command_id: reusedCommand, action: "create",
      quote_id: crossContractQuote.quoteId, expected_quote_version: 1,
    }),
    lifecycleFixture.order(sql, crossContractQuote.authority, {
      command_id: reusedCommand, quote_id: crossContractQuote.quoteId,
      expected_quote_version: 1,
      contact: { name: "Cross Contract", phone: "5551234567" },
    }),
  ]);
  assert.equal(crossContract.filter((result) => result.outcome === "accepted").length, 1);
  assert.equal(crossContract.filter((result) =>
    (result.error as Record<string, unknown> | undefined)?.code ===
      "stale_version"
  ).length, 1);
  return first;
}
