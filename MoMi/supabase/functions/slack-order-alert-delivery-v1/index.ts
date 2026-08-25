import "edge-runtime"

import { handleRequest } from "../../../services/slack-order-delivery/functions/slack-order-alert-delivery-v1/src/handle_request.ts"

Deno.serve(handleRequest)
