import { getDefaultSecretKey } from "./get_default_secret_key.ts"

export async function invokeEligibility(rawEventId: string): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const secretKey = getDefaultSecretKey(
    Deno.env.get("SUPABASE_SECRET_KEYS"),
  )

  if (!supabaseUrl || !secretKey) {
    console.error("Toast alert eligibility configuration unavailable", rawEventId)
    return
  }

  try {
    const endpoint = new URL(
      "/functions/v1/toast-order-alert-eligibility-v1",
      supabaseUrl,
    )
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: secretKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ raw_event_id: rawEventId }),
    })

    if (!response.ok) {
      console.error("Toast alert eligibility invocation failed", rawEventId, response.status)
    }
  } catch (error) {
    console.error("Toast alert eligibility invocation failed", rawEventId, error)
  }
}
