import "edge-runtime"

import { handleRequest } from "../../../services/toast-order-ingest/functions/toast-orders-webhook-ingest-v1/src/handle_request.ts"

Deno.serve(handleRequest)
