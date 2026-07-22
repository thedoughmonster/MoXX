import type { JSONValue } from "postgres"
import { callProvider } from "./call_provider.ts"
import { captureEvidence } from "./capture_evidence.ts"
import { completeInvocation } from "./complete_invocation.ts"
import { failedProviderResponse } from "./failed_provider_response.ts"
import { authorizeProviderRound } from "./mark_provider_started.ts"
import { estimateProviderPayloadTokens } from "./provider_payload_policy.ts"
import { routeDecision } from "./route_decision.ts"
import { remainingDeadlineSeconds } from "./remaining_deadline_seconds.ts"
import { persistRoute } from "./persist_route.ts"
import { usage } from "./provider_usage.ts"
import type { Admission, ChatInput, RouteSelection, RoutingPolicy } from "./types.ts"

export async function runRouter(input: ChatInput, admission: Admission,
  policy: RoutingPolicy, request: Record<string, JSONValue>): Promise<{
    route: RouteSelection | null
    failure: { status: number; body: Record<string, JSONValue> } | null
  }> {
  if (!await authorizeProviderRound(admission.invocation_id,
    estimateProviderPayloadTokens(request), 1)) throw new Error("router_round_not_authorized")
  const result = await callProvider(policy.router_endpoint, request,
    remainingDeadlineSeconds(admission.invocation_deadline))
  const terminal = result.ambiguous ? "paid_ambiguous" : result.ok ? "routing" : "failed"
  const receipt = await captureEvidence(input, admission.invocation_id, 1,
    "routing_response", { routing_request: request, routing_response: result.body },
    admission.provider_key, policy.router_model, terminal, usage(result.body),
    { duration_ms: result.duration_ms, http_status: result.status })
  if (result.ambiguous || !result.ok) {
    const state = result.ambiguous ? "paid_ambiguous" : "failed"
    await completeInvocation(admission.invocation_id, state, receipt.archive_item_id, 0,
      result.ambiguous ? "router_transport_ambiguous" : `router_http_${result.status}`)
    return { route: null, failure: failedProviderResponse(admission.invocation_id, state) }
  }
  const route = routeDecision(result.body, policy)
  await persistRoute(admission.invocation_id, input.user.id, route)
  return { route, failure: null }
}
