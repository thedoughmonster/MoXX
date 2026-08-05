import { getDatabase } from "./database.ts";
import type { TickInput } from "./types.ts";

export async function readTickReceipt(
  input: TickInput,
): Promise<unknown | null> {
  const sql = getDatabase();
  const rows = await sql<{ receipt: unknown | null }[]>`
    select momi_cron_history.read_tick_receipt_v1(
      ${input.tick_id}::uuid, ${input.capability_token}::uuid
    ) as receipt
  `;
  return rows[0]?.receipt ?? null;
}
