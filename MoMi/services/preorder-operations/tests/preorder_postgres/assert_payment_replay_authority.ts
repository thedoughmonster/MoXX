import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { paymentFixture } from "./payment_fixture.ts";

export async function assertPaymentReplayAuthority(
  sql: Sql,
  request: Record<string, unknown>,
  authority: string,
  attemptId: string,
) {
  const wrongAuthority = `wrong-authority-${crypto.randomUUID()}`;
  const unauthorized = await paymentFixture.claim(sql, {
    command_id: crypto.randomUUID(), order_id: crypto.randomUUID(),
    expected_order_version: 1,
  }, wrongAuthority);
  const [currentBefore] = await sql<{ state: Record<string, unknown> }[]>`
    select jsonb_build_object(
      'attempt', to_jsonb(a), 'order', to_jsonb(o)) as state
    from momi_preorder.payment_attempts a
    join momi_preorder.orders o on o.order_id = a.order_id
    where a.payment_attempt_id = ${attemptId}::uuid`;
  const unauthorizedCurrent = await paymentFixture.claim(
    sql, request, wrongAuthority,
  );
  assert.deepEqual(unauthorizedCurrent, unauthorized);
  const [currentAfter] = await sql<{ state: Record<string, unknown> }[]>`
    select jsonb_build_object(
      'attempt', to_jsonb(a), 'order', to_jsonb(o)) as state
    from momi_preorder.payment_attempts a
    join momi_preorder.orders o on o.order_id = a.order_id
    where a.payment_attempt_id = ${attemptId}::uuid`;
  assert.deepEqual(currentAfter?.state, currentBefore?.state);

  await sql`update momi_preorder.payment_attempts
    set claim_expires_at = clock_timestamp() - interval '1 millisecond'
    where payment_attempt_id = ${attemptId}::uuid`;
  const [expiredBefore] = await sql<{ state: Record<string, unknown> }[]>`
    select jsonb_build_object(
      'attempt', to_jsonb(a), 'order', to_jsonb(o)) as state
    from momi_preorder.payment_attempts a
    join momi_preorder.orders o on o.order_id = a.order_id
    where a.payment_attempt_id = ${attemptId}::uuid`;
  const unauthorizedExpired = await paymentFixture.claim(
    sql, request, wrongAuthority,
  );
  assert.deepEqual(unauthorizedExpired, unauthorized);
  const [expiredAfter] = await sql<{ state: Record<string, unknown> }[]>`
    select jsonb_build_object(
      'attempt', to_jsonb(a), 'order', to_jsonb(o)) as state
    from momi_preorder.payment_attempts a
    join momi_preorder.orders o on o.order_id = a.order_id
    where a.payment_attempt_id = ${attemptId}::uuid`;
  assert.deepEqual(expiredAfter?.state, expiredBefore?.state);

  const authorizedExpired = await paymentFixture.claim(sql, request, authority);
  assert.equal(authorizedExpired.disposition, "replay");
  assert.equal(
    (authorizedExpired.receipt as Record<string, unknown>).payment_status,
    "indeterminate",
  );
}
