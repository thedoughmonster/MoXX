import assert from "node:assert/strict";
import type { Sql } from "postgres";
import { launchBigAppleId, launchConfig, launchItemId,
  launchSurfaceId } from "./launch_policy_fixture.ts";
export async function assertLaunchPolicy(sql: Sql): Promise<void> {
  const [eligibility] = await sql<{ inclusive: boolean; expired: boolean }[]>`
    select
      momi_preorder.item_eligible_on_v1(true, 'ends_on', null,
        '2026-08-10'::date, '2026-08-10'::date) as inclusive,
      momi_preorder.item_eligible_on_v1(true, 'ends_on', null,
        '2026-08-10'::date, '2026-08-11'::date) as expired`;
  assert.deepEqual(eligibility, { inclusive: true, expired: false });
  const [publication] = await sql<{ receipt: Record<string, unknown> }[]>`
    select momi_preorder.publish_configuration_v1(
      ${sql.json(launchConfig)}::jsonb, ${"c".repeat(64)}, 'postgres-test'
    ) as receipt`;
  assert.equal(publication.receipt.mode, "active");
  const [schedule] = await sql<{ days: number; windows: number;
    invalid_windows: number }[]>`
    select
      (select count(*)::integer from
        momi_preorder.configuration_pickup_schedule_days) as days,
      count(*)::integer as windows,
      count(*) filter (where
        (extract(isodow from fulfillment_date) between 1 and 5 and
          to_char(starts_at at time zone 'America/New_York', 'HH24:MI') <> '07:00')
        or (extract(isodow from fulfillment_date) in (6, 7) and
          to_char(starts_at at time zone 'America/New_York', 'HH24:MI') <> '08:00')
        or to_char(ends_at at time zone 'America/New_York', 'HH24:MI') <> '14:00'
        or (order_cutoff_at at time zone 'America/New_York')::date <>
          fulfillment_date - 1
        or to_char(order_cutoff_at at time zone 'America/New_York', 'HH24:MI')
          <> '17:00'
        or capacity_limit <> 75 or limited_threshold <> 27
        or policy_version <> 1)::integer as invalid_windows
    from momi_preorder.fulfillment_windows
    where surface_id = ${launchSurfaceId}::uuid`;
  assert.deepEqual(schedule, { days: 7, windows: 14, invalid_windows: 0 });
  const [window] = await sql<{ window_id: string; fulfillment_date: string }[]>`
    select window_id, fulfillment_date::text
    from momi_preorder.fulfillment_windows
    where surface_id = ${launchSurfaceId}::uuid and order_cutoff_at > now()
    order by fulfillment_date desc limit 1`;
  assert.ok(window);
  const versions = { surface_version: 1, catalog_version: 1,
    policy_version: 1, mapping_version: 1 };
  const request = { command_id: crypto.randomUUID(), surface_id: launchSurfaceId,
    fulfillment_window_id: window.window_id, versions, cart_version: 1,
    avoided_allergens: [] as string[], lines: [{ line_id: crypto.randomUUID(),
      item_id: launchItemId, item_version: 1, quantity: 1, choice_ids: [] }] };
  const [general] = await sql<{ result: Record<string, unknown> }[]>`
    select momi_preorder.create_quote_v1(${sql.json(request)}::jsonb) as result`;
  assert.equal(general.result.outcome, "accepted");
  const generalQuote = general.result.quote as Record<string, unknown>;
  assert.equal((generalQuote.quantity_savings as Record<string, unknown>).amount_minor, 0);
  assert.equal((generalQuote.notice_savings as Record<string, unknown>).amount_minor, 0);
  const authority = String(generalQuote.revalidation_token);
  const quoteId = String(generalQuote.quote_id);
  const [hold] = await sql<{ result: Record<string, unknown> }[]>`
    select momi_preorder.manage_checkout_hold_v1(${sql.json({
      command_id: crypto.randomUUID(), action: "create", quote_id: quoteId,
      expected_quote_version: 1,
    })}::jsonb, ${authority}) as result`;
  assert.equal(hold.result.outcome, "accepted");
  const [order] = await sql<{ result: Record<string, unknown> }[]>`
    select momi_preorder.create_order_intent_v1(${sql.json({
      command_id: crypto.randomUUID(), quote_id: quoteId,
      expected_quote_version: 1, hold_id: hold.result.hold_id,
      contact: { name: "Launch Test", email: "launch@example.test" },
    })}::jsonb, ${authority}) as result`;
  assert.equal(order.result.outcome, "accepted");
  request.command_id = crypto.randomUUID();
  request.avoided_allergens = ["peanuts"];
  const [avoided] = await sql<{ result: Record<string, unknown> }[]>`
    select momi_preorder.create_quote_v1(${sql.json(request)}::jsonb) as result`;
  assert.equal((avoided.result.error as Record<string, unknown>).code,
    "allergen_unverified");
  request.command_id = crypto.randomUUID();
  request.avoided_allergens = [];
  request.lines[0].item_id = launchBigAppleId;
  const [equal] = await sql<{ result: Record<string, unknown> }[]>`
    select momi_preorder.create_quote_v1(${sql.json(request)}::jsonb) as result`;
  const equalQuote = equal.result.quote as Record<string, unknown>;
  assert.equal((equalQuote.total as Record<string, unknown>).amount_minor, 350);
  assert.equal((equalQuote.preorder_savings_total as Record<string, unknown>)
    .amount_minor, 0);
  await sql`update momi_preorder.fulfillment_windows set committed_quantity = 48
    where window_id = ${window.window_id}::uuid`;
  const [bootstrap] = await sql<{ data: Record<string, unknown> }[]>`
    select momi_preorder.read_bootstrap_v1(
      'launch-test', ${window.fulfillment_date}::date) as data`;
  const windows = bootstrap.data.fulfillment_windows as Array<Record<string, unknown>>;
  assert.equal(windows[0].availability, "limited");
  const inactive = structuredClone(launchConfig);
  inactive.publication_ref = "71000000-0000-4000-8000-000000000006";
  inactive.publication_mode = "inactive";
  inactive.surface.enabled = false;
  await sql`select momi_preorder.publish_configuration_v1(
    ${sql.json(inactive)}::jsonb, ${"d".repeat(64)}, 'postgres-test')`;
  const [disabled] = await sql<{ enabled: boolean; version: number }[]>`
    select enabled, policy_version as version from momi_preorder.surfaces
    where surface_id = ${launchSurfaceId}::uuid`;
  assert.deepEqual(disabled, { enabled: false, version: 2 });
  const restore = structuredClone(launchConfig);
  restore.publication_ref = "71000000-0000-4000-8000-000000000007";
  await sql`select momi_preorder.publish_configuration_v1(
    ${sql.json(restore)}::jsonb, ${"e".repeat(64)}, 'postgres-test')`;
  const [preserved] = await sql<{ total: number; current: number }[]>`
    select count(*)::integer as total,
      count(*) filter (where policy_version = 3)::integer as current
    from momi_preorder.fulfillment_windows
    where surface_id = ${launchSurfaceId}::uuid`;
  assert.deepEqual(preserved, { total: 28, current: 14 });
  const [frozen] = await sql<{ status: Record<string, unknown> }[]>`
    select momi_preorder.read_order_status_v1(
      ${(order.result.order_id as string)}::uuid,
      ${String(order.result.recovery_authority)}) as status`;
  assert.equal((frozen.status.fulfillment_window as Record<string, unknown>)
    .window_id, window.window_id);
}
