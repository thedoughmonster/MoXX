import "edge-runtime"
import { handleRequest } from "../../../services/order-alerting/functions/momi-order-alert-worker-v1/src/handle_request.ts"

Deno.serve(handleRequest)
