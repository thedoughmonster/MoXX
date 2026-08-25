import "edge-runtime"
import { handleRequest } from "../../../services/model-execution-gateway/functions/momi-model-execution-webhook-v1/src/handle_request.ts"

Deno.serve(handleRequest)
