import { executePayment } from
  "../../../../square-payment-delivery/contracts/public/square.payment.execute.v1/index.ts"
import { claimPayment } from "./claim_payment.ts"
import { projectPayment } from "./project_payment.ts"
import { readLocationId } from "./read_location_id.ts"
import type { InitiateDependencies } from "./types.ts"

export const initiateDependencies: InitiateDependencies = {
  getLocationId: readLocationId,
  claim: claimPayment,
  deliver: executePayment,
  project: projectPayment,
}
