import "edge-runtime"
import { handleRequest } from "../../../services/momi-event-routing/functions/momi-event-router-v1/src/handle_request.ts"

Deno.serve(handleRequest)
