import "edge-runtime"
import { handleRequest } from "../../../services/communications-gateway/functions/momi-communications-gateway-v1/src/handle_request.ts"

Deno.serve(handleRequest)
