import { retrievePayment } from
  "../../../../square-payment-acquisition/contracts/public/square.payment.retrieve.v1/index.ts"
import { claimReconciliation } from "./claim_reconciliation.ts"
import { projectPayment } from "./project_payment.ts"
import { readLocationId } from "./read_location_id.ts"
import type { ReconcileDependencies } from "./types.ts"

export const reconcileDependencies: ReconcileDependencies = {
  getLocationId: readLocationId,
  claim: claimReconciliation,
  retrieve: retrievePayment,
  project: projectPayment,
}
