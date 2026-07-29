import "edge-runtime"

import { handleRequest } from "../../../services/trello-task-delivery/functions/trello-register-webhook-v1/src/handle_request.ts"

Deno.serve(handleRequest)
