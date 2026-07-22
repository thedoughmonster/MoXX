import type { JSONValue } from "postgres"
import type { AnalysisCatalogEntry } from "./analysis_types.ts"

export const functionKey = "momi.communications.chat_completions.v1"
export const visibleAlias = "momi-assistant"
export const routeKeys = ["quick", "standard", "deep", "maximum"] as const

export type RouteKey = typeof routeKeys[number]
export type RequestedRoute = "auto" | RouteKey

export type ToolCall = {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

export type Message =
  | { role: "system" | "developer" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string }

export type UserFlag = {
  scope: "message" | "turn" | "range" | "conversation"
  message_id?: string
  range?: Record<string, JSONValue>
  selected_content?: string
  note?: string
  category?: string
}

export type ChatInput = {
  model: typeof visibleAlias
  momi_route?: RequestedRoute
  messages: Message[]
  user: { id: string; email: string }
  conversation_id: string
  turn_id: string
  idempotency_key: string
  momi_log?: UserFlag
}

export type AssistantContext = {
  context_version: string
  assistant_name: string
  organization_name: string
  organization_aliases: string[]
  context_summary: string
  primary_scope_key: string
  primary_location_name: string
  primary_timezone: string
  current_business_date: string
  analysis_catalog: AnalysisCatalogEntry[]
}
export type Admission = {
  disposition: "admitted" | "duplicate"
  invocation_id: string
  provider_key: string
  provider_model: string
  provider_endpoint: string
  maximum_output_tokens: number
  timeout_seconds: number
  maximum_attempt_cost_micros: string
  maximum_input_tokens: number
  invocation_deadline: string
  invocation_status: string
  error_code: string | null
}

export type RouteProfile = {
  route_key: RouteKey
  route_rank: number
  provider_model: string
  reasoning_effort: "none" | "low" | "medium" | "high" | "xhigh" | "max"
  maximum_output_tokens: number
  automatic_enabled: boolean
}

export type RoutingPolicy = {
  router_endpoint: string
  answer_endpoint: string
  router_model: string
  router_reasoning_effort: "none" | "low" | "medium"
  router_prompt_version: string
  default_route: RouteKey
  maximum_route: RouteKey
  profiles: RouteProfile[]
}

export type RouteSelection = RouteProfile & {
  provider_endpoint: string
  source: "explicit" | "router" | "fallback"
  reason: string
  confidence: number
}

export type ArchiveReceipt = {
  disposition: "stored" | "duplicate"
  archive_item_id: string
  content_hash: string
}

export type ProviderResult = {
  ok: boolean
  ambiguous: boolean
  status: number
  body: Record<string, JSONValue>
  duration_ms: number
}

export type ToolContext = {
  input: ChatInput
  invocationId: string
  archiveReceiptId: string
  logSelection: LogSelection | null
}

export type LogSelection = {
  flag: UserFlag
  content: Record<string, JSONValue>
}
