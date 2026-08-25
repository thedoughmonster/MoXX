import type { JSONValue } from "postgres"
import { callProvider } from "./call_provider.ts"
import { captureEvidence } from "./capture_evidence.ts"
import { completeInvocation } from "./complete_invocation.ts"
import { failedProviderResponse } from "./failed_provider_response.ts"
import { authorizeProviderRound } from "./mark_provider_started.ts"
import { estimateProviderPayloadTokens } from "./provider_payload_policy.ts"
import { routeDecision } from "./route_decision.ts"
import { responseCompleted } from "./response_completed.ts"
import { persistRoute } from "./persist_route.ts"
import { usage } from "./provider_usage.ts"
import type { Admission, ChatInput, RouteSelection, RoutingPolicy } from "./types.ts"

export async function runRouter(input: ChatInput, admission: Admission,
  policy: RoutingPolicy, request: Record<string, JSONValue>): Promise<{
    route: RouteSelection | null
    failure: { status: number; body: Record<string, JSONValue> } | null
  }> {
  await captureEvidence(input, admission.invocation_id, 1,
    "routing_request", { routing_request: request }, admission.provider_key,
    "profile:communications.router/auto", "pending")
  if (!await authorizeProviderRound(admission.invocation_id,
    estimateProviderPayloadTokens(request), 1)) throw new Error("router_round_not_authorized")
  const result = await callProvider("communications.router", "auto",
    admission.invocation_id, `${admission.invocation_id}:router`, request,
    500, false, admission.invocation_deadline)
  const completed = responseCompleted(result.body)
  const terminal = result.ambiguous ? "paid_ambiguous"
    : result.ok && completed ? "routing" : "failed"
  const receipt = await captureEvidence(input, admission.invocation_id, 2,
    "routing_response", { routing_response: result.body },
    admission.provider_key, result.provider_model, terminal, usage(result.body),
    { duration_ms: result.duration_ms, http_status: result.status })
  if (result.ambiguous || !result.ok || !completed) {
    const state = result.ambiguous ? "paid_ambiguous" : "failed"
    await completeInvocation(admission.invocation_id, state, receipt.archive_item_id, 0,
      result.ambiguous ? "router_transport_ambiguous" : !result.ok
      ? `router_http_${result.status}` : "router_response_incomplete", null)
    return { route: null, failure: failedProviderResponse(admission.invocation_id, state) }
  }
  const route = routeDecision(result.body, policy)
  await persistRoute(admission.invocation_id, input.user.id, route)
  return { route, failure: null }
}
