import "edge-runtime"
import { handleRequest } from "../../../services/warehouse-read-api/functions/momi-orders-get-by-version-v1/src/handle_request.ts"

Deno.serve(handleRequest)
