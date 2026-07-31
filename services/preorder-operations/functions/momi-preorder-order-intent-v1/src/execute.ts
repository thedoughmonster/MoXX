import { getDatabase } from "./database.ts";
import { functionKey, type OrderExecution, type OrderInput } from "./types.ts";

export async function execute(
  input: OrderInput,
  authority: string,
): Promise<OrderExecution> {
  const sql = getDatabase();
  const rows = await sql<OrderExecution[]>`
    with admission as (
      select momi_preorder.admit_public_request_v1(
        ${functionKey}, ${authority}
      ) as admitted
    )
    select admission.admitted,
      case when admission.admitted then
        momi_preorder.create_order_intent_v1(
          ${sql.json(input)}::jsonb,
          ${authority}
        )
      else null end as result
    from admission
  `;
  return rows[0] ?? { admitted: false, result: null };
}
