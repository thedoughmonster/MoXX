import "edge-runtime"

import { handleRequest } from "../../../services/toast-order-hydration/functions/toast-orders-fetch-by-guid-v1/src/handle_request.ts"

Deno.serve(handleRequest)
