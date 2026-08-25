import {
  functionKey,
  type RoutingInput,
  type RoutingResult,
  type RoutingStore,
} from "./types.ts"

const additionalBatchSize = 49

export async function processRouting(
  input: RoutingInput,
  store: RoutingStore,
): Promise<RoutingResult> {
  const claimed = await store.claimItem(input.event_id, input.capability_token)
  if (!claimed) {
    return { status: 202, body: { ok: true, function_key: functionKey,
      event_id: input.event_id, disposition: "duplicate" } }
  }
  const routeClaimed = async (item: RoutingInput) => {
    try {
      return { ok: true, deliveryCount: await store.routeEvent(
        item.event_id, item.capability_token,
      ) }
    } catch (error) {
      const message = error instanceof Error ? error.message : "routing failed"
      try {
        await store.failRouting(item.event_id, item.capability_token, message)
      } catch (failureError) {
        console.error("routing failure could not be persisted", failureError)
      }
      return { ok: false, deliveryCount: 0 }
    }
  }
  const primary = await routeClaimed(input)
  if (!primary.ok) {
    return { status: 503, body: { ok: false, function_key: functionKey,
      event_id: input.event_id, disposition: "retrying" } }
  }
  try {
    const additional = await store.claimBatch(additionalBatchSize)
    for (const item of additional) await routeClaimed(item)
  } catch (error) {
    console.error("additional routing work could not be claimed", error)
  }
  return { status: 200, body: { ok: true, function_key: functionKey,
    event_id: input.event_id, disposition: "routed",
    delivery_count: primary.deliveryCount } }
}
