import postgres from "postgres";

import { assertDatabaseTarget } from "./target_identity.ts";
import type { PreorderConfiguration, PublicationExecution,
  PublicationReadback } from "./types.ts";

export async function publishConfig(
  config: PreorderConfiguration,
  digest: string,
  actorRef: string,
  projectRef: string,
): Promise<PublicationExecution> {
  const databaseUrl = process.env.MOMI_PREORDER_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("MOMI_PREORDER_DATABASE_URL is not configured");
  }
  assertDatabaseTarget(databaseUrl, projectRef);
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ssl: "verify-full",
  });
  try {
    await sql`begin`;
    const rows = await sql<{ receipt: Record<string, unknown> }[]>`
      select momi_preorder.publish_configuration_v1(
        ${sql.json(config)}, ${digest}, ${actorRef}
      ) as receipt
    `;
    const readbackRows = await sql<{ readback: PublicationReadback }[]>`
      select jsonb_build_object(
        'publication_ref', publication.publication_ref,
        'config_digest', publication.config_digest,
        'publication_mode', publication.publication_mode,
        'resulting_version', publication.resulting_version,
        'surface_enabled', surface.enabled,
        'active_publication_matches',
          surface.active_publication_id = publication.publication_id,
        'price_class_count', (select count(*) from
          momi_preorder.configuration_price_classes price_class
          where price_class.publication_id = publication.publication_id),
        'item_policy_count', (select count(*) from
          momi_preorder.configuration_item_policies item_policy
          where item_policy.publication_id = publication.publication_id),
        'schedule_day_count', (select count(*) from
          momi_preorder.configuration_pickup_schedule_days schedule
          where schedule.publication_id = publication.publication_id),
        'catalog_item_count', (select count(*) from
          momi_preorder.catalog_items item where item.surface_id = surface.surface_id
            and item.catalog_version = surface.catalog_version),
        'window_count', (select count(*) from
          momi_preorder.fulfillment_windows window
          where window.surface_id = surface.surface_id
            and window.policy_version = surface.policy_version),
        'contract_valid',
          publication.configuration = ${sql.json(config)}::jsonb
          and (select count(*) from
            momi_preorder.configuration_price_classes price_class
            where price_class.publication_id = publication.publication_id) =
              jsonb_array_length(publication.configuration->'price_classes')
          and (select count(*) from
            momi_preorder.configuration_item_policies item_policy
            where item_policy.publication_id = publication.publication_id) =
              jsonb_array_length(publication.configuration->'catalog')
          and (publication.schema_version <> 3 or (select count(*) from
            momi_preorder.configuration_pickup_schedule_days schedule
            where schedule.publication_id = publication.publication_id) = 7)
          and (publication.publication_mode = 'draft' or (
            surface.active_publication_id = publication.publication_id
            and surface.enabled = (publication.publication_mode = 'active')
            and (publication.publication_mode <> 'active' or (
              (select count(*) from momi_preorder.catalog_items item
                where item.surface_id = surface.surface_id
                  and item.catalog_version = surface.catalog_version) =
                (select count(*) from jsonb_array_elements(
                  publication.configuration->'catalog') item
                  where coalesce((item->>'available')::boolean, false))
              and (select count(*) from momi_preorder.fulfillment_windows window
                where window.surface_id = surface.surface_id
                  and window.policy_version = surface.policy_version) = 14
              and not exists (
                select 1 from momi_preorder.fulfillment_windows window
                join momi_preorder.configuration_pickup_schedule_days schedule
                  on schedule.publication_id = publication.publication_id
                  and schedule.iso_weekday =
                    extract(isodow from window.fulfillment_date)::integer
                where window.surface_id = surface.surface_id
                  and window.policy_version = surface.policy_version
                  and (
                    (window.starts_at at time zone surface.timezone)::time <>
                      schedule.starts_local
                    or (window.ends_at at time zone surface.timezone)::time <>
                      schedule.ends_local
                    or (window.order_cutoff_at at time zone surface.timezone)::date <>
                      window.fulfillment_date - schedule.cutoff_days_before
                    or (window.order_cutoff_at at time zone surface.timezone)::time <>
                      schedule.cutoff_local
                    or window.capacity_limit <>
                      (publication.configuration->'capacity_policy'->>
                        'daily_limit')::integer
                    or window.limited_threshold <>
                      (publication.configuration->'capacity_policy'->>
                        'limited_threshold')::integer)
              )
            ))
          ))
      ) as readback
      from momi_preorder.configuration_publications publication
      left join momi_preorder.surfaces surface
        on surface.surface_key = publication.surface_key
      where publication.config_digest = ${digest}
    `;
    const receipt = rows[0]?.receipt;
    const readback = readbackRows[0]?.readback;
    if (!receipt || !readback?.contract_valid) {
      throw new Error("Configuration publication readback failed");
    }
    await sql`commit`;
    return { receipt, readback };
  } catch (error) {
    await sql`rollback`;
    throw error;
  } finally {
    await sql.end();
  }
}
