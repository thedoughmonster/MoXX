import { randomUUID } from "node:crypto";
import { invoiceFixture } from "./fixture.ts";

export const calendarMetadata = { customer_name: "Synthetic Delivery Shop", fulfillment: "delivery", discontinued: false };

export async function saveCalendar(db: { query: Function }, expected = 0, version = invoiceFixture.version,
  metadata = calendarMetadata, command = randomUUID(), order = invoiceFixture.order) {
  const result = await db.query("select bridge.invoice_save_standing_order_v2($1,$2,$3::jsonb,$4::jsonb,$5::jsonb) as result",
    [command, expected, JSON.stringify(order), JSON.stringify(version), JSON.stringify(metadata)]);
  return result.rows[0].result;
}
