import type { JSONValue } from "postgres"
import { captureEvidence } from "./capture_evidence.ts"
import { explicitRoute } from "./explicit_route.ts"
import { loadRoutingPolicy } from "./load_routing_policy.ts"
import { markArchiveAdmitted } from "./mark_archive_admitted.ts"
import { persistRoute } from "./persist_route.ts"
import { routerRequest } from "./router_request.ts"
import { runRouter } from "./run_router.ts"
import { visibleAlias, type Admission, type ChatInput, type RouteSelection } from "./types.ts"

export async function beginRoute(input: ChatInput, admission: Admission,
  tools: JSONValue[]): Promise<{
    route: RouteSelection | null
    archiveReceiptId: string
    providerRound: 1 | 2
    evidenceOrder: 1 | 3
    failure: { status: number; body: Record<string, JSONValue> } | null
  }> {
  const requested = input.momi_route ?? "auto"
  const receipt = await captureEvidence(input, admission.invocation_id, 0,
    "request_admission", { alias: visibleAlias, requested_route: requested,
      input: input as unknown as JSONValue, tools }, admission.provider_key,
    admission.provider_model, "pending")
  if (!await markArchiveAdmitted(admission.invocation_id, receipt.archive_item_id)) {
    throw new Error("archive_admission_state_failed")
  }
  const policy = await loadRoutingPolicy(input.user.id)
  let route: RouteSelection | null = null
  if (requested !== "auto") {
    route = explicitRoute(requested, policy)
    await persistRoute(admission.invocation_id, input.user.id, route)
  }
  if (route) return { route, archiveReceiptId: receipt.archive_item_id,
    providerRound: 1, evidenceOrder: 1, failure: null }
  const routed = await runRouter(input, admission, policy, routerRequest(input, policy))
  return { route: routed.route, archiveReceiptId: receipt.archive_item_id,
    providerRound: 2, evidenceOrder: 3, failure: routed.failure }
}
