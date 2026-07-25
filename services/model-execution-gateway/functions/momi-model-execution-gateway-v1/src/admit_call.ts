import { getDatabase } from "./database.ts"
import type { Admission, CallerKey, CreateRequest } from "./types.ts"

export async function admitCall(
  caller: CallerKey,
  request: CreateRequest,
  requestHash: string,
  inputTokens: number,
): Promise<Admission> {
  const sql = getDatabase()
  const rows = await sql<Admission[]>`
    select * from momi_model_execution.admit_call_v1(
      ${caller}, ${request.purpose_key}, ${request.profile_key},
      ${request.parent_invocation_id}, ${request.idempotency_key}, ${requestHash},
      ${inputTokens}, ${request.requested_output_tokens}, ${request.background},
      ${Deno.env.get("DENO_DEPLOYMENT_ID") ?? "local"}
    )
  `
  if (!rows[0]) throw new Error("model execution admission failed")
  return rows[0]
}
