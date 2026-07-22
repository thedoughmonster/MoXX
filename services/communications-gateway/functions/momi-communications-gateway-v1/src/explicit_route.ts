import type { RouteSelection, RoutingPolicy } from "./types.ts"

export function explicitRoute(route: string, policy: RoutingPolicy): RouteSelection {
  const maximumRank = policy.profiles.find((profile) => profile.route_key === policy.maximum_route)?.route_rank ?? 0
  const selected = policy.profiles.find((profile) => profile.route_key === route)
  if (!selected || selected.route_rank > maximumRank) throw new Error("route_not_authorized")
  return { ...selected, source: "explicit", reason: "user selected route", confidence: 1 }
}
