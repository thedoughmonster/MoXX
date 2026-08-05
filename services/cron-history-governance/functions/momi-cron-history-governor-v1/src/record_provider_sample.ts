import { getDatabase } from "./database.ts";
import type { ProviderMetricSample, TickInput } from "./types.ts";

export async function recordProviderSample(
  input: TickInput,
  sample: ProviderMetricSample,
): Promise<unknown> {
  const sql = getDatabase();
  const rows = await sql<{ result: unknown }[]>`
    select momi_cron_history.record_provider_sample_v1(
      ${input.tick_id}::uuid,
      ${input.capability_token}::uuid,
      ${sample.sourceObservedAt}::timestamptz,
      ${sample.cpuTotalSeconds}::numeric,
      ${sample.cpuIdleSeconds}::numeric,
      ${sample.ramPct}::numeric,
      ${sample.swapUsedBytes}::numeric,
      ${sample.ioBusySeconds}::numeric,
      ${sample.allocatedDiskPct}::numeric,
      ${sample.providerConnections}::integer,
      ${sample.providerWarning}::boolean,
      ${sample.sourceComplete}::boolean
    ) as result
  `;
  if (!rows[0]?.result) throw new Error("sample_receipt_missing");
  return rows[0].result;
}
