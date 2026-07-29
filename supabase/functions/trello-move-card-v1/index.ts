import "edge-runtime"

import { handleRequest } from "../../../services/trello-task-delivery/functions/trello-move-card-v1/src/handle_request.ts"

Deno.serve(handleRequest)
