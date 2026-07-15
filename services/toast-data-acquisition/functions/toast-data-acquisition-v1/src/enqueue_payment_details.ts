import { sql } from "./database.ts";
import type { ClaimedJob } from "./registry_types.ts";

export async function enqueuePaymentDetails(
  job: ClaimedJob,
  paymentGuids: string[],
): Promise<number> {
  if (paymentGuids.length === 0) return 0;
  const rows = await sql<{ inserted: number }[]>`
    select toast_acquisition.enqueue_payment_detail_jobs(
      ${job.job_id}::bigint,
      ${job.capability_token}::uuid,
      ${sql.array(paymentGuids)}::text[]
    ) as inserted
  `;
  const inserted = rows[0]?.inserted;
  if (!Number.isInteger(inserted)) {
    throw new Error("Payment detail jobs were not enqueued");
  }
  return inserted;
}
