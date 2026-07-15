import type {
  DeliveryTrigger,
  DeliveryFailure,
  SourceEvent,
  WorkerStore,
} from "../src/types.ts"

export const eventId = "83fb9d92-851b-4c30-9a12-b849d640b5b1"
export const correlationId = "bd34cadc-9733-43a6-a5ba-fee19e26635c"
export const capabilityToken = "93995d12-ed79-4d29-95d5-7e7fb79f701c"
export const deliveryTriggerFixture: DeliveryTrigger = {
  event_id: eventId,
  message_id: "1",
  capability_token: capabilityToken,
}
export const sourceEventFixture: SourceEvent = {
  event_id: eventId,
  event_name: "source.toast.resource.order.observed",
  source_system: "toast",
  entity_type: null,
  entity_id: null,
  occurred_at: "2026-07-14T18:00:00+00:00",
  schema_version: 1,
  source_reference: {
    schema: "toast_raw",
    table: "resource_observations",
    id: 41,
  },
  correlation_id: correlationId,
}

export class FakeStore implements WorkerStore {
  sourceEvents = new Map<string, SourceEvent | null>([
    [eventId, sourceEventFixture],
  ])
  beginOutcomes = new Map<string, boolean>()
  projectionOutcomes = new Map<string, unknown>()
  failureOutcomes = new Map<string, DeliveryFailure>()
  calls: string[] = []
  failureErrors: string[] = []
  lifecycleTokens: string[] = []
  wakeError: Error | null = null

  beginDelivery(
    _eventId: string,
    messageId: string,
    token: string,
  ): Promise<boolean> {
    this.calls.push(`begin:${messageId}`)
    this.lifecycleTokens.push(token)
    return Promise.resolve(this.beginOutcomes.get(messageId) ?? true)
  }

  readSourceEvent(targetEventId: string): Promise<SourceEvent | null> {
    this.calls.push(`source:${targetEventId}`)
    return Promise.resolve(this.sourceEvents.get(targetEventId) ?? null)
  }

  projectToastEvent(targetEventId: string): Promise<unknown> {
    this.calls.push(`project:${targetEventId}`)
    const outcome = this.projectionOutcomes.get(targetEventId) ?? "projected"
    return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome)
  }

  acknowledgeDelivery(
    _eventId: string,
    messageId: string,
    token: string,
  ): Promise<boolean> {
    this.calls.push(`ack:${messageId}`)
    this.lifecycleTokens.push(token)
    return Promise.resolve(true)
  }

  failDelivery(
    _eventId: string,
    messageId: string,
    token: string,
    error: string,
  ): Promise<DeliveryFailure> {
    this.calls.push(`fail:${messageId}`)
    this.lifecycleTokens.push(token)
    this.failureErrors.push(error)
    return Promise.resolve(this.failureOutcomes.get(messageId) ?? "retry_wait")
  }

  wakeNextDelivery(): Promise<boolean> {
    this.calls.push("wake:next")
    return this.wakeError ? Promise.reject(this.wakeError) : Promise.resolve(true)
  }
}
