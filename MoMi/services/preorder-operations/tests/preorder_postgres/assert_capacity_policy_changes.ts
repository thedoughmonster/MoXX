import assert from "node:assert/strict";
import type { Sql } from "postgres";
import { launchConfig, launchSurfaceId } from "./launch_policy_fixture.ts";

export async function assertCapacityPolicyChanges(sql: Sql): Promise<void> {
  const [candidate] = await sql`
    select fulfillment_date::text as fulfillment_date
    from momi_preorder.fulfillment_windows
    where surface_id = ${launchSurfaceId}::uuid
    group by fulfillment_date having sum(held_quantity + committed_quantity) = 0
    order by fulfillment_date desc limit 1`;
  const date = candidate.fulfillment_date;
  await sql`update momi_preorder.fulfillment_windows set committed_quantity = 75
    where surface_id = ${launchSurfaceId}::uuid and policy_version = 1
      and fulfillment_date = ${date}::date`;
  const increased = structuredClone(launchConfig);
  increased.publication_ref = "71000000-0000-4000-8000-000000000009";
  increased.capacity_policy.daily_limit = 100;
  await sql`select momi_preorder.publish_configuration_v1(
    ${sql.json(increased)}::jsonb, ${"7".repeat(64)}, 'postgres-test')`;
  const [current] = await sql`
    select window_id from momi_preorder.fulfillment_windows window
    join momi_preorder.surfaces surface using (surface_id)
    where window.surface_id = ${launchSurfaceId}::uuid
      and window.policy_version = surface.policy_version
      and window.fulfillment_date = ${date}::date`;
  await sql`update momi_preorder.fulfillment_windows
    set held_quantity = held_quantity + 1 where window_id = ${current.window_id}::uuid`;
  await sql`update momi_preorder.fulfillment_windows
    set held_quantity = held_quantity where window_id = ${current.window_id}::uuid`;
  const [usage] = await sql`select held_quantity + committed_quantity as total
    from momi_preorder.fulfillment_capacity
    where surface_id = ${launchSurfaceId}::uuid and fulfillment_date = ${date}::date`;
  assert.equal(usage.total, 76);
  await sql`update momi_preorder.fulfillment_windows set held_quantity = 24
    where window_id = ${current.window_id}::uuid`;
  const admissions = await Promise.allSettled([1, 2].map(() => sql`
    update momi_preorder.fulfillment_windows set held_quantity = held_quantity + 1
    where window_id = ${current.window_id}::uuid`));
  assert.equal(admissions.filter((result) => result.status === "fulfilled").length, 1);
  const [limited] = await sql`select held_quantity + committed_quantity as total
    from momi_preorder.fulfillment_capacity
    where surface_id = ${launchSurfaceId}::uuid and fulfillment_date = ${date}::date`;
  assert.equal(limited.total, 100);
  await sql`update momi_preorder.fulfillment_windows set committed_quantity = 74
    where surface_id = ${launchSurfaceId}::uuid and policy_version = 1
      and fulfillment_date = ${date}::date`;
  const lowered = structuredClone(increased);
  lowered.publication_ref = "71000000-0000-4000-8000-00000000000a";
  lowered.capacity_policy.daily_limit = 50;
  await sql`select momi_preorder.publish_configuration_v1(
    ${sql.json(lowered)}::jsonb, ${"8".repeat(64)}, 'postgres-test')`;
  await assert.rejects(sql`update momi_preorder.fulfillment_windows
    set held_quantity = held_quantity + 1 where window_id = ${current.window_id}::uuid`);
  await sql`update momi_preorder.fulfillment_windows set held_quantity = held_quantity - 1
    where window_id = ${current.window_id}::uuid`;
}
