import "edge-runtime"

import { handleRequest } from "../../../services/toast-stock-ingest/functions/toast-stock-webhook-ingest-v1/src/handle_request.ts"

Deno.serve(handleRequest)
