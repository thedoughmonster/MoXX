import "edge-runtime"
import { handleRequest } from "../../../services/warehouse-read-api/functions/momi-warehouse-employees-get-by-id-v1/src/handle_request.ts"

Deno.serve(handleRequest)
