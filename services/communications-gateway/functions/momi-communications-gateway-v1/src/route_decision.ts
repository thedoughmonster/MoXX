import type { JSONValue } from "postgres"
import { responseText } from "./response_text.ts"
import type { RoutingPolicy, RouteSelection } from "./types.ts"

export function routeDecision(body: Record<string, JSONValue>, policy: RoutingPolicy): RouteSelection {
  const content = responseText(body)
  let value: Record<string, unknown> | null = null
  try { value = content ? JSON.parse(content) as Record<string, unknown> : null }
  catch { value = null }
  if (value && (Object.keys(value).sort().join(",") !== "confidence,reason,route" ||
    typeof value.reason !== "string" || value.reason.length < 1 || value.reason.length > 240 ||
    typeof value.confidence !== "number")) value = null
  const maximumRank = policy.profiles.find((profile) => profile.route_key === policy.maximum_route)?.route_rank ?? 0
  const selected = typeof value?.route === "string" ? policy.profiles.find((profile) =>
    profile.route_key === value?.route && profile.automatic_enabled && profile.route_rank <= maximumRank) : null
  if (selected && typeof value?.reason === "string" && typeof value?.confidence === "number") {
    return { ...selected, provider_endpoint: policy.answer_endpoint,
      source: "router", reason: value.reason.slice(0, 240),
      confidence: Math.max(0, Math.min(1, value.confidence)) }
  }
  const fallback = policy.profiles.find((profile) => profile.route_key === policy.default_route &&
    profile.route_rank <= maximumRank)
  if (!fallback) throw new Error("routing_fallback_unavailable")
  return { ...fallback, provider_endpoint: policy.answer_endpoint,
    source: "fallback", reason: "router output was invalid", confidence: 0 }
}
