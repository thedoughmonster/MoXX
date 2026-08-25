import { handleEntityRequest } from "../../../src/handle_entity_request.ts"
import type { EntityReadContract } from "../../../src/types.ts"

const contract: EntityReadContract = {
  functionKey: "momi.menu_entities.get_by_id.v1",
  entityType: "menu_entity",
  storedEntityTypes: [
    "menu", "menu_group", "menu_item", "modifier_group", "modifier_option",
  ],
  viewName: "menu_entities_by_id_v1",
}

export function handleRequest(request: Request): Promise<Response> {
  return handleEntityRequest(request, contract)
}
