import "edge-runtime"
import { handleRequest } from "../../../services/warehouse-read-api/functions/momi-admin-data-v1/src/handle_request.ts"

Deno.serve(handleRequest)
