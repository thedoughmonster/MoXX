import { getDatabase } from "./database.ts";
import type { TickClaim, TickInput } from "./types.ts";

export async function claimTick(input: TickInput): Promise<TickClaim | null> {
  const sql = getDatabase();
  const rows = await sql<TickClaim[]>`
    select tick_status, phase
    from momi_cron_history.claim_governor_tick_v1(
      ${input.tick_id}::uuid, ${input.capability_token}::uuid
    )
  `;
  return rows[0] ?? null;
}
