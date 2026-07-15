import { handleEntityRequest } from "../../../src/handle_entity_request.ts"
import type { EntityReadContract } from "../../../src/types.ts"

const contract: EntityReadContract = {
  functionKey: "momi.employees.get_by_id.v1",
  entityType: "employee",
  viewName: "employees_by_id_v1",
}

export function handleRequest(request: Request): Promise<Response> {
  return handleEntityRequest(request, contract)
}
