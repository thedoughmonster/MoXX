import { getDatabase } from "./database.ts";
import { functionKey, type QuoteCreation, type QuoteInput } from "./types.ts";

export async function createQuote(input: QuoteInput): Promise<QuoteCreation> {
  const sql = getDatabase();
  const rows = await sql<QuoteCreation[]>`
    with admission as (
      select momi_preorder.admit_public_read_v1(${functionKey}) as admitted
    )
    select admission.admitted,
      case when admission.admitted then
        momi_preorder.create_quote_v1(${sql.json(input)}::jsonb)
      else null end as result
    from admission
  `;
  return rows[0] ?? { admitted: false, result: null };
}
