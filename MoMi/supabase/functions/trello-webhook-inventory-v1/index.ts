import "edge-runtime"

import { handleRequest } from "../../../services/trello-data-acquisition/functions/trello-webhook-inventory-v1/src/handle_request.ts"

Deno.serve(handleRequest)
