import type { JSONValue } from "postgres"
import { appendLogSelection } from "./append_log_selection.ts"
import { captureEvidence } from "./capture_evidence.ts"
import { createUserFlagLog } from "./create_user_flag_log.ts"
import { explicitRoute } from "./explicit_route.ts"
import { loadRoutingPolicy } from "./load_routing_policy.ts"
import { markArchiveAdmitted } from "./mark_archive_admitted.ts"
import { persistRoute } from "./persist_route.ts"
import { providerRequest } from "./provider_request.ts"
import { resolveLogSelection } from "./resolve_log_selection.ts"
import { routerRequest } from "./router_request.ts"
import { runRouter } from "./run_router.ts"
import { visibleAlias, type Admission, type ChatInput, type RouteSelection } from "./types.ts"

export async function beginRoute(input: ChatInput, admission: Admission,
  tools: JSONValue[]): Promise<{
    route: RouteSelection | null
    archiveReceiptId: string
    providerRound: 1 | 2
    evidenceOrder: 1 | 2
    failure: { status: number; body: Record<string, JSONValue> } | null
  }> {
  const policy = await loadRoutingPolicy(input.user.id)
  const requested = input.momi_route ?? "auto"
  let route: RouteSelection | null = null
  let initialRequest: Record<string, JSONValue>
  if (requested === "auto") initialRequest = routerRequest(input, policy)
  else {
    route = explicitRoute(requested, policy)
    await persistRoute(admission.invocation_id, input.user.id, route)
    initialRequest = providerRequest(input.messages, input.user.id, admission, route, tools)
  }
  const receipt = await captureEvidence(input, admission.invocation_id, 0,
    "request_admission", { alias: visibleAlias, requested_route: requested,
      initial_provider_request: initialRequest }, admission.provider_key,
    requested === "auto" ? policy.router_model : route?.provider_model ?? policy.router_model,
    "pending")
  if (!await markArchiveAdmitted(admission.invocation_id, receipt.archive_item_id)) {
    throw new Error("archive_admission_state_failed")
  }
  const logSelection = resolveLogSelection(input)
  await appendLogSelection(logSelection, { input, invocationId: admission.invocation_id,
    archiveReceiptId: receipt.archive_item_id, logSelection }, createUserFlagLog)
  if (route) return { route, archiveReceiptId: receipt.archive_item_id,
    providerRound: 1, evidenceOrder: 1, failure: null }
  const routed = await runRouter(input, admission, policy, initialRequest)
  return { route: routed.route, archiveReceiptId: receipt.archive_item_id,
    providerRound: 2, evidenceOrder: 2, failure: routed.failure }
}
