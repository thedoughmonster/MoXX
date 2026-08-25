import { acknowledgeDelivery } from "./ack_delivery.ts"
import { beginDelivery } from "./begin_delivery.ts"
import { executeWork } from "./execute_work.ts"
import { failDelivery } from "./fail_delivery.ts"
import { stageEventWork } from "./stage_event_work.ts"
import type { DeliveryWorkerStore } from "./delivery_types.ts"

export const deliveryWorkerStore: DeliveryWorkerStore = {
  beginDelivery,
  stageEventWork,
  executeWork,
  acknowledgeDelivery,
  failDelivery,
}
