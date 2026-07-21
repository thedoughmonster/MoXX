import { getDatabase } from "./database.ts"

export async function handleAdmin(
  pathname: string,
  value: unknown,
): Promise<Response> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Response.json({ error: "invalid_request" }, { status: 400 })
  }
  const body = value as Record<string, unknown>
  const adminId = Deno.env.get("MOMI_BETA_ADMIN_USER_ID")
  if (!adminId || body.actor_user_id !== adminId) {
    return Response.json({ error: "admin_required" }, { status: 403 })
  }
  const sql = getDatabase()
  if (pathname.endsWith("/admin/user-access")) {
    if (typeof body.user_id !== "string" || typeof body.email !== "string" ||
      typeof body.active !== "boolean") return Response.json({ error: "invalid_request" }, { status: 400 })
    await sql`select momi_communications_gateway.set_user_access_v1(
      ${adminId}::uuid, true, ${body.user_id}::uuid, ${body.email}, ${body.active}
    )`
  } else if (pathname.endsWith("/admin/user-limits")) {
    const numeric = ["requests_per_minute", "maximum_input_tokens",
      "maximum_output_tokens", "timeout_seconds", "budget_micros"]
    if (typeof body.user_id !== "string" || numeric.some((key) =>
      typeof body[key] !== "number" || !Number.isSafeInteger(body[key]))) {
      return Response.json({ error: "invalid_request" }, { status: 400 })
    }
    const requestsPerMinute = body.requests_per_minute as number
    const maximumInputTokens = body.maximum_input_tokens as number
    const maximumOutputTokens = body.maximum_output_tokens as number
    const timeoutSeconds = body.timeout_seconds as number
    const budgetMicros = body.budget_micros as number
    await sql`select momi_communications_gateway.set_user_limits_v1(
      ${adminId}::uuid, true, ${body.user_id}::uuid,
      ${requestsPerMinute}::integer, ${maximumInputTokens}::integer,
      ${maximumOutputTokens}::integer, ${timeoutSeconds}::integer,
      ${budgetMicros}::bigint
    )`
  } else if (pathname.endsWith("/admin/gateway-state")) {
    if (typeof body.enabled !== "boolean" || typeof body.cohort_enabled !== "boolean" ||
      typeof body.provider_key !== "string" || typeof body.provider_model !== "string" ||
      typeof body.maximum_attempt_cost_micros !== "number" ||
      !Number.isSafeInteger(body.maximum_attempt_cost_micros)) {
      return Response.json({ error: "invalid_request" }, { status: 400 })
    }
    await sql`select momi_communications_gateway.set_gateway_state_v1(
      ${adminId}::uuid, true, ${body.enabled}, ${body.cohort_enabled},
      ${body.provider_key}, ${body.provider_model},
      ${body.maximum_attempt_cost_micros}::bigint
    )`
  } else return Response.json({ error: "not_found" }, { status: 404 })
  return Response.json({ ok: true })
}
