import { beginDelivery } from "./begin_delivery.ts"
import { failDelivery } from "./fail_delivery.ts"
import { projectAndAcknowledgeDelivery } from "./project_and_ack_delivery.ts"
import { readSourceEvent } from "./read_source_event.ts"
import type { WorkerStore } from "./types.ts"
import { wakeNextDelivery } from "./wake_next_delivery.ts"

export const workerStore: WorkerStore = {
  beginDelivery,
  readSourceEvent,
  projectAndAcknowledgeDelivery,
  failDelivery,
  wakeNextDelivery,
}
