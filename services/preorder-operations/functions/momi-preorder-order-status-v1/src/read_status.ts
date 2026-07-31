import { getDatabase } from "./database.ts";
import { functionKey, type StatusRead } from "./types.ts";

export async function readStatus(
  orderId: string,
  authority: string,
): Promise<StatusRead> {
  const sql = getDatabase();
  const rows = await sql<StatusRead[]>`
    with admission as (
      select momi_preorder.admit_public_request_v1(
        ${functionKey}, ${authority}
      ) as admitted
    )
    select admission.admitted,
      case when admission.admitted then
        momi_preorder.read_order_status_v1(${orderId}::uuid, ${authority})
      else null end as data
    from admission
  `;
  return rows[0] ?? { admitted: false, data: null };
}
