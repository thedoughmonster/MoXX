import type { PGlite } from "@electric-sql/pglite"

export async function previewWeek(db: PGlite, orderId: string, monday: string) {
  const result = await db.query<{ result: {
    snapshot_id: string; week_id: string; order_id: string; order_revision: number;
    week_start: string; week_end: string; timezone: string; currency: string;
    total_minor: number; subtotal_minor: number; tax_minor: number; enabled: boolean;
    basis: string; sending_hold: boolean; dates: Array<{
      date: string; version_id: string | null; state: string; sending_hold: boolean; notes: string
    }>; lines: Array<{
      date: string; case_quantity: number; case_price_minor: number; amount_minor: number;
      catalog_item_id: string; catalog_version: string; name: string;
      catalog_snapshot: Record<string, unknown>; notes: string
    }>
  } }>("select bridge.invoice_preview_week_v1($1,$2) as result", [orderId, monday])
  return result.rows[0].result
}
