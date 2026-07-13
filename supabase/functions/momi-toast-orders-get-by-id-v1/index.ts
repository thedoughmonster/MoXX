import "edge-runtime"

import { handleRequest } from "../../../services/toast-order-read-api/functions/momi-toast-orders-get-by-id-v1/src/handle_request.ts"

Deno.serve(handleRequest)
