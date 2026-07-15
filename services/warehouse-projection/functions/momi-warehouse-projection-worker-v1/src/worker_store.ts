import { acknowledgeDelivery } from "./ack_delivery.ts"
import { beginDelivery } from "./begin_delivery.ts"
import { failDelivery } from "./fail_delivery.ts"
import { projectToastEvent } from "./project_toast_event.ts"
import { readSourceEvent } from "./read_source_event.ts"
import type { WorkerStore } from "./types.ts"
import { wakeNextDelivery } from "./wake_next_delivery.ts"

export const workerStore: WorkerStore = {
  beginDelivery,
  readSourceEvent,
  projectToastEvent,
  acknowledgeDelivery,
  failDelivery,
  wakeNextDelivery,
}
