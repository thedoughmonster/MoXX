import "edge-runtime"

import { handleRequest } from "../../../services/toast-data-acquisition/functions/toast-data-acquisition-v1/src/handle_request.ts"

Deno.serve(handleRequest)
