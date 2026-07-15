import "edge-runtime"

import { handleRequest } from "../../../services/toast-webhook-ingestion/functions/toast-webhooks-ingest-v1/src/handle_request.ts"

Deno.serve(handleRequest)
