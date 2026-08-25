import "edge-runtime"

import { handleRequest } from "../../../services/trello-evidence-ingestion/functions/trello-webhooks-ingest-v1/src/handle_request.ts"

Deno.serve(handleRequest)
