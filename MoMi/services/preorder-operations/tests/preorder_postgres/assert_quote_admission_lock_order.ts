import assert from "node:assert/strict";
import type { Sql } from "postgres";
import { launchItemId, launchSurfaceId } from "./launch_policy_fixture.ts";
import { waitForDatabaseBlock } from "./wait_for_database_block.ts";

export async function assertQuoteAdmissionLockOrder(sql: Sql): Promise<void> {
  const [window] = await sql`select w.window_id, s.surface_version,
    s.catalog_version, s.policy_version, s.mapping_version
    from momi_preorder.fulfillment_windows w
    join momi_preorder.surfaces s using (surface_id)
    where w.surface_id = ${launchSurfaceId}::uuid
      and w.policy_version = s.policy_version and w.order_cutoff_at > now()
    order by w.fulfillment_date limit 1`;
  const request = { command_id: crypto.randomUUID(), surface_id: launchSurfaceId,
    fulfillment_window_id: window.window_id, versions: window, cart_version: 1,
    avoided_allergens: [], lines: [{ line_id: crypto.randomUUID(),
      item_id: launchItemId, item_version: 1, quantity: 1, choice_ids: [] }] };
  const [quoted] = await sql`select momi_preorder.create_quote_v1(
    ${sql.json(request)}::jsonb) as result`;
  assert.equal(quoted.result.outcome, "accepted");
  const quote = quoted.result.quote;
  const admission = await sql.reserve();
  const quoting = await sql.reserve();
  let pending: Promise<unknown> | undefined;
  let committed = false;
  try {
    await admission`begin`;
    await admission`set local statement_timeout = '10s'`;
    const [owner] = await admission`select pg_backend_pid() as pid`;
    const [waiter] = await quoting`select pg_backend_pid() as pid`;
    await admission`select 1 from momi_preorder.fulfillment_windows
      where window_id = ${window.window_id}::uuid for update`;
    pending = quoting`select momi_preorder.create_quote_v1(${sql.json({
      ...request, command_id: crypto.randomUUID(),
    })}::jsonb) as result`.execute().then((rows) => {
      assert.equal(rows[0].result.outcome, "accepted");
    });
    void pending.catch(() => undefined);
    // Observe the quote waiting on W before admission requests C. The old
    // BEFORE INSERT trigger already held C here and formed a W/C deadlock.
    await waitForDatabaseBlock(sql, waiter.pid, owner.pid);
    const [held] = await admission`select momi_preorder.manage_checkout_hold_v1(
      ${sql.json({ command_id: crypto.randomUUID(), action: "create",
        quote_id: quote.quote_id, expected_quote_version: 1 })}::jsonb,
      ${quote.revalidation_token}) as result`;
    assert.equal(held.result.outcome, "accepted");
    await admission`commit`;
    committed = true;
    await pending;
    const [usage] = await sql`select c.held_quantity, c.committed_quantity
      from momi_preorder.fulfillment_capacity c
      join momi_preorder.fulfillment_windows w using (surface_id, fulfillment_date)
      where w.window_id = ${window.window_id}::uuid`;
    assert.deepEqual(usage, { held_quantity: 1, committed_quantity: 0 });
    await sql`select momi_preorder.manage_checkout_hold_v1(${sql.json({
      command_id: crypto.randomUUID(), action: "release", quote_id: quote.quote_id,
      expected_quote_version: 1, hold_id: held.result.hold_id,
    })}::jsonb, ${quote.revalidation_token})`;
  } finally {
    if (!committed) await admission`rollback`;
    await pending?.catch(() => undefined);
    admission.release();
    quoting.release();
  }
}
