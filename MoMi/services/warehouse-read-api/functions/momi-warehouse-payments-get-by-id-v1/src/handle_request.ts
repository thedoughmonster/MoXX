import { handleEntityRequest } from "../../../src/handle_entity_request.ts"
import type { EntityReadContract } from "../../../src/types.ts"

const contract: EntityReadContract = {
  functionKey: "momi.payments.get_by_id.v1",
  entityType: "payment",
  viewName: "payments_by_id_v1",
}

export function handleRequest(request: Request): Promise<Response> {
  return handleEntityRequest(request, contract)
}
