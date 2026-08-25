import type { ClaimedCompletion } from "./types.ts"

export async function notifyCaller(
  work: ClaimedCompletion,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (work.caller_key !== "communications-gateway") return true
  const endpoint = Deno.env.get("MOMI_COMMUNICATIONS_COMPLETION_URL")?.trim()
  const secret = Deno.env.get("MOMI_MODEL_COMPLETION_CALLBACK_SECRET")?.trim()
  if (!endpoint || !secret) throw new Error("completion_callback_unavailable")
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ schema_version: 1, call_id: work.call_id,
      provider_response_id: work.provider_response_id }),
    signal: AbortSignal.timeout(120_000),
  })
  return response.ok
}
