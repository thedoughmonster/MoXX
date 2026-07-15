export const functionKey = "momi.events.route.v1"

export type RoutingInput = {
  event_id: string
  capability_token: string
}

export type RoutingStore = {
  claimItem: (eventId: string, capabilityToken: string) => Promise<boolean>
  claimBatch: (limit: number) => Promise<RoutingInput[]>
  routeEvent: (eventId: string, capabilityToken: string) => Promise<number>
  failRouting: (
    eventId: string,
    capabilityToken: string,
    error: string,
  ) => Promise<boolean>
}

export type RoutingResult = {
  status: number
  body: {
    ok: boolean
    function_key: typeof functionKey
    event_id: string
    disposition: "duplicate" | "routed" | "retrying"
    delivery_count?: number
  }
}
