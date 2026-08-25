import type {
  DeliveryTrigger,
  DeliveryFailure,
  ProjectionWorkerSettings,
  SourceEvent,
  WorkerStore,
} from "../src/types.ts"
import { classifyProjectionOutcome } from "../src/classify_projection_outcome.ts"

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
  reservedTriggers: DeliveryTrigger[] = []
  workerSettings: ProjectionWorkerSettings = {
    worker_max_runtime_seconds: 400,
    worker_max_deliveries: 500,
    handoff_reserve_seconds: 30,
    shutdown_margin_seconds: 10,
  }

  beginDelivery(
    _eventId: string,
    messageId: string,
    token: string,
  ): Promise<boolean> {
    this.calls.push(`begin:${messageId}`)
    this.lifecycleTokens.push(token)
    return Promise.resolve(this.beginOutcomes.get(messageId) ?? true)
  }

  readSourceEvent(
    targetEventId: string,
    _messageId: string,
    _capabilityToken: string,
  ): Promise<SourceEvent | null> {
    this.calls.push(`source:${targetEventId}`)
    return Promise.resolve(this.sourceEvents.get(targetEventId) ?? null)
  }

  projectAndAcknowledgeDelivery(
    targetEventId: string,
    messageId: string,
    token: string,
  ): Promise<unknown> {
    this.calls.push(`project:${targetEventId}`)
    const outcome = this.projectionOutcomes.get(targetEventId) ?? "projected"
    if (outcome instanceof Error) return Promise.reject(outcome)
    if (classifyProjectionOutcome(outcome)) {
      this.calls.push(`ack:${messageId}`)
      this.lifecycleTokens.push(token)
    }
    return Promise.resolve(outcome)
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

  readWorkerSettings(): Promise<ProjectionWorkerSettings> {
    this.calls.push("settings:read")
    return Promise.resolve(this.workerSettings)
  }

  reserveNextDelivery(): Promise<DeliveryTrigger | null> {
    this.calls.push("reserve:next")
    return Promise.resolve(this.reservedTriggers.shift() ?? null)
  }
}
