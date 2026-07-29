import { claimOperation } from "./claim_operation.ts"
import { sql } from "./database.ts"
import { finishOperation } from "./finish_operation.ts"
import { sendMoveCard } from "./send_move_card.ts"
import type { DeliveryDependencies } from "./types.ts"

export const deliveryDependencies: DeliveryDependencies = {
  getSetting: (name) => Deno.env.get(name),
  claim: (work) => claimOperation(sql, work),
  deliver: (operation, key, token, marker) => sendMoveCard(operation, key, token, marker),
  finish: (operation, result, marker) => finishOperation(sql, operation, result, marker),
}
