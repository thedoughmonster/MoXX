import "edge-runtime"
import { handleRequest } from "../../../services/warehouse-projection/functions/momi-warehouse-projection-worker-v1/src/handle_request.ts"

Deno.serve(handleRequest)
