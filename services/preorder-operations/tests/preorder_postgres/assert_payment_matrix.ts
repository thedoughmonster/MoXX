import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { Sql } from "postgres";

export async function assertPaymentMatrix(sql: Sql, orderId: string) {
  const lifecycle = JSON.parse(await readFile(new URL(
    "../../contracts/payment-lifecycle-v1.json", import.meta.url), "utf8"));
  const statuses = Object.keys(lifecycle.transitions) as string[];
  for (const from of statuses) {
    for (const to of statuses) {
      const [row] = await sql<{ allowed: boolean }[]>`
        select momi_preorder.payment_transition_allowed_v1(
          ${from}, ${to}) as allowed`;
      assert.equal(row?.allowed,
        (lifecycle.transitions[from] as string[]).includes(to),
        `${from} -> ${to}`);
    }
    const [actions] = await sql<{ value: string[] }[]>`
      select momi_preorder.payment_next_actions_v1(
        ${orderId}::uuid, ${from}) as value`;
    assert.deepEqual(actions?.value, lifecycle.recovery_actions[from]);
  }
}
