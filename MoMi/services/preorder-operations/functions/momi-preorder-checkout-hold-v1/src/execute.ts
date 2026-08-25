import { getDatabase } from "./database.ts";
import { functionKey, type HoldExecution, type HoldInput } from "./types.ts";

export async function execute(
  input: HoldInput,
  authority: string,
): Promise<HoldExecution> {
  const sql = getDatabase();
  const rows = await sql<HoldExecution[]>`
    with admission as (
      select momi_preorder.admit_public_request_v1(
        ${functionKey}, ${authority}
      ) as admitted
    )
    select admission.admitted,
      case when admission.admitted then
        momi_preorder.manage_checkout_hold_v1(
          ${sql.json(input)}::jsonb,
          ${authority}
        )
      else null end as result
    from admission
  `;
  return rows[0] ?? { admitted: false, result: null };
}
