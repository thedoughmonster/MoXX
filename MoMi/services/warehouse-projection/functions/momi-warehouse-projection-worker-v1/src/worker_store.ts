import { beginDelivery } from "./begin_delivery.ts"
import { failDelivery } from "./fail_delivery.ts"
import { projectAndAcknowledgeDelivery } from "./project_and_ack_delivery.ts"
import { readWorkerSettings } from "./read_worker_settings.ts"
import { readSourceEvent } from "./read_source_event.ts"
import { reserveNextDelivery } from "./reserve_next_delivery.ts"
import type { WorkerStore } from "./types.ts"

export const workerStore: WorkerStore = {
  beginDelivery,
  readSourceEvent,
  projectAndAcknowledgeDelivery,
  failDelivery,
  readWorkerSettings,
  reserveNextDelivery,
}
