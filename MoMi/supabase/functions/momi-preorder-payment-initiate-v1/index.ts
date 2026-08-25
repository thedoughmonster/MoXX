import "edge-runtime"

import { handleRequest } from "../../../services/preorder-operations/functions/momi-preorder-payment-initiate-v1/src/handle_request.ts"

Deno.serve(handleRequest)
