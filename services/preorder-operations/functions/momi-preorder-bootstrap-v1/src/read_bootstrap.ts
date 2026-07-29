import { getDatabase } from "./database.ts";
import {
  type BootstrapInput,
  type BootstrapRead,
  functionKey,
} from "./types.ts";

export async function readBootstrap(
  input: BootstrapInput,
): Promise<BootstrapRead> {
  const sql = getDatabase();
  const rows = await sql<BootstrapRead[]>`
    with admission as (
      select momi_preorder.admit_public_read_v1(${functionKey}) as admitted
    )
    select admission.admitted,
      case when admission.admitted and
        momi_preorder.refresh_fulfillment_windows_v1(${input.surface_key})
      then momi_preorder.read_bootstrap_v1(
          ${input.surface_key}, ${input.fulfillment_date}::date
        )
      else null end as data
    from admission
  `;
  return rows[0] ?? { admitted: false, data: null };
}
